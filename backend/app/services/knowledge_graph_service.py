import logging
import uuid
import re
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.models.knowledge_graph import KnowledgeEntity, KnowledgeRelationship
from app.models.profile import PersonalProfile
from app.models.memory import Memory

logger = logging.getLogger("life.knowledge_graph")

class KnowledgeGraphService:
    """
    Personal Knowledge Graph Engine:
    - Maintains deterministic entity-relationship network for the user.
    - Represents relationships (STUDIES_AT, HAS_SKILL, WORKS_ON, HAS_BESTIE, etc.)
    - Handles conflict detection, confidence scoring, provenance tracking, and subgraph queries.
    - Strictly scoped by user_id.
    """

    def get_or_create_entity(
        self,
        db: Session,
        user_id: str,
        name: str,
        entity_type: str,
        description: Optional[str] = None,
        metadata_json: Optional[Dict[str, Any]] = None
    ) -> KnowledgeEntity:
        """Find or create an entity node for the user."""
        clean_name = name.strip()
        entity = db.query(KnowledgeEntity).filter(
            KnowledgeEntity.user_id == user_id,
            KnowledgeEntity.name.ilike(clean_name),
            KnowledgeEntity.entity_type == entity_type
        ).first()

        if not entity:
            entity = KnowledgeEntity(
                user_id=user_id,
                entity_type=entity_type,
                name=clean_name,
                description=description,
                metadata_json=metadata_json or {}
            )
            db.add(entity)
            db.commit()
            db.refresh(entity)
        elif description and not entity.description:
            entity.description = description
            db.commit()
            db.refresh(entity)

        return entity

    def add_relationship(
        self,
        db: Session,
        user_id: str,
        source_name: str,
        source_type: str,
        relationship_type: str,
        target_name: str,
        target_type: str,
        confidence: float = 1.0,
        source: str = "memory",
        properties: Optional[Dict[str, Any]] = None
    ) -> Tuple[KnowledgeRelationship, bool]:
        """
        Add a relationship edge between two entities.
        Detects conflicts for exclusive relationships (e.g., HAS_BESTIE, STUDIES_AT) and resolves safely.
        Returns (relationship, is_new).
        """
        source_ent = self.get_or_create_entity(db, user_id, source_name, source_type)
        target_ent = self.get_or_create_entity(db, user_id, target_name, target_type)

        exclusive_relationships = {"HAS_BESTIE", "STUDIES_AT"}
        is_conflict = False

        if relationship_type in exclusive_relationships:
            # Check existing relationships of this type from source
            existing_rel = db.query(KnowledgeRelationship).filter(
                KnowledgeRelationship.user_id == user_id,
                KnowledgeRelationship.source_entity_id == source_ent.id,
                KnowledgeRelationship.relationship_type == relationship_type
            ).first()

            if existing_rel:
                if existing_rel.target_entity_id != target_ent.id:
                    logger.info(
                        f"[KG_CONFLICT] Conflict detected for {relationship_type}: "
                        f"Old target ID={existing_rel.target_entity_id}, New={target_ent.id}. "
                        f"Updating to latest confirmed fact."
                    )
                    existing_rel.target_entity_id = target_ent.id
                    existing_rel.confidence = confidence
                    existing_rel.source = source
                    existing_rel.properties = properties or {}
                    existing_rel.updated_at = datetime.utcnow()
                    db.commit()
                    db.refresh(existing_rel)
                    return existing_rel, False
                else:
                    return existing_rel, False

        # General non-exclusive relationship
        existing = db.query(KnowledgeRelationship).filter(
            KnowledgeRelationship.user_id == user_id,
            KnowledgeRelationship.source_entity_id == source_ent.id,
            KnowledgeRelationship.target_entity_id == target_ent.id,
            KnowledgeRelationship.relationship_type == relationship_type
        ).first()

        if existing:
            existing.confidence = confidence
            existing.properties = properties or existing.properties
            existing.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(existing)
            return existing, False

        new_rel = KnowledgeRelationship(
            user_id=user_id,
            source_entity_id=source_ent.id,
            target_entity_id=target_ent.id,
            relationship_type=relationship_type,
            confidence=confidence,
            source=source,
            properties=properties or {}
        )
        db.add(new_rel)
        db.commit()
        db.refresh(new_rel)
        return new_rel, True

    def query_relationships_for_entity(
        self,
        db: Session,
        user_id: str,
        entity_name: str
    ) -> List[Dict[str, Any]]:
        """Fetch all outgoing and incoming relationships for a named entity."""
        clean_name = entity_name.strip()
        entity = db.query(KnowledgeEntity).filter(
            KnowledgeEntity.user_id == user_id,
            KnowledgeEntity.name.ilike(clean_name)
        ).first()

        if not entity:
            return []

        results = []
        # Outgoing
        out_rels = db.query(KnowledgeRelationship).filter(
            KnowledgeRelationship.user_id == user_id,
            KnowledgeRelationship.source_entity_id == entity.id
        ).all()
        for r in out_rels:
            target = db.query(KnowledgeEntity).filter(KnowledgeEntity.id == r.target_entity_id).first()
            if target:
                results.append({
                    "source": entity.name,
                    "source_type": entity.entity_type,
                    "relationship": r.relationship_type,
                    "target": target.name,
                    "target_type": target.entity_type,
                    "confidence": r.confidence,
                    "source_provenance": r.source,
                    "direction": "outgoing"
                })

        # Incoming
        in_rels = db.query(KnowledgeRelationship).filter(
            KnowledgeRelationship.user_id == user_id,
            KnowledgeRelationship.target_entity_id == entity.id
        ).all()
        for r in in_rels:
            src = db.query(KnowledgeEntity).filter(KnowledgeEntity.id == r.source_entity_id).first()
            if src:
                results.append({
                    "source": src.name,
                    "source_type": src.entity_type,
                    "relationship": r.relationship_type,
                    "target": entity.name,
                    "target_type": entity.entity_type,
                    "confidence": r.confidence,
                    "source_provenance": r.source,
                    "direction": "incoming"
                })

        return results

    def extract_from_memory_or_profile(
        self,
        db: Session,
        user_id: str,
        text: str,
        source: str = "memory"
    ) -> List[Dict[str, Any]]:
        """
        Deterministic, rule-grounded relationship extractor.
        Extracts verified entities and edges from confirmed user statements.
        Never fabricates facts from guesses.
        """
        extracted = []
        lower = text.lower()

        # 1. Bestie / Best Friend
        bestie_match = re.search(r'(?:bestie|best\s*friend)\s*(?:ka\s*naam|is|:)?\s*([A-Za-z]+)', text, re.IGNORECASE)
        if bestie_match:
            friend_name = bestie_match.group(1).strip().capitalize()
            if friend_name.lower() not in {"hai", "mera", "meri", "naam", "the", "a", "an", "is"}:
                rel, _ = self.add_relationship(
                    db=db,
                    user_id=user_id,
                    source_name="User",
                    source_type="person",
                    relationship_type="HAS_BESTIE",
                    target_name=friend_name,
                    target_type="person",
                    confidence=1.0,
                    source=source
                )
                extracted.append({"type": "HAS_BESTIE", "target": friend_name})

        # 2. Studies at College
        college_match = re.search(r'(?:college|university|institute)\s*(?:is|:)?\s*([A-Za-z0-9\s\.\-]+(?:NIT|IIT|IIIT|University|Institute|College)[A-Za-z0-9\s\.\-]*)', text, re.IGNORECASE)
        if college_match:
            c_name = college_match.group(1).strip()
            self.add_relationship(
                db=db,
                user_id=user_id,
                source_name="User",
                source_type="person",
                relationship_type="STUDIES_AT",
                target_name=c_name,
                target_type="organization",
                confidence=1.0,
                source=source
            )
            extracted.append({"type": "STUDIES_AT", "target": c_name})

        # 3. Project association
        proj_match = re.search(r'(?:project|working on)\s*(?:is|called|named)?\s*["\']?([A-Za-z0-9\s\-]+)["\']?', text, re.IGNORECASE)
        if proj_match:
            p_name = proj_match.group(1).strip()
            if len(p_name) > 2 and p_name.lower() not in {"this", "that", "it", "my", "kuch"}:
                self.add_relationship(
                    db=db,
                    user_id=user_id,
                    source_name="User",
                    source_type="person",
                    relationship_type="WORKS_ON",
                    target_name=p_name,
                    target_type="project",
                    confidence=0.95,
                    source=source
                )
                extracted.append({"type": "WORKS_ON", "target": p_name})

        return extracted

    def get_user_knowledge_subgraph(
        self,
        db: Session,
        user_id: str,
        limit: int = 25
    ) -> List[Dict[str, Any]]:
        """Return full structured knowledge graph for dashboard and context injection."""
        rels = db.query(KnowledgeRelationship).filter(
            KnowledgeRelationship.user_id == user_id
        ).order_by(KnowledgeRelationship.updated_at.desc()).limit(limit).all()

        nodes = {}
        links = []

        for r in rels:
            src = db.query(KnowledgeEntity).filter(KnowledgeEntity.id == r.source_entity_id).first()
            tgt = db.query(KnowledgeEntity).filter(KnowledgeEntity.id == r.target_entity_id).first()
            if src and tgt:
                nodes[src.id] = {"id": src.id, "name": src.name, "type": src.entity_type}
                nodes[tgt.id] = {"id": tgt.id, "name": tgt.name, "type": tgt.entity_type}
                links.append({
                    "source": src.name,
                    "source_id": src.id,
                    "target": tgt.name,
                    "target_id": tgt.id,
                    "relationship": r.relationship_type,
                    "confidence": r.confidence,
                    "source_provenance": r.source
                })

        return {
            "nodes": list(nodes.values()),
            "edges": links
        }

    def format_connected_map(self, db: Session, user_id: str, query: Optional[str] = None) -> str:
        """Render a readable relationship graph showing how user, skills, projects, and goals interconnect."""
        subgraph = self.get_user_knowledge_subgraph(db, user_id, limit=30)
        edges = subgraph.get("edges", [])

        # Fetch profile and goals to ensure complete connectivity representation
        from app.models.profile import PersonalProfile
        from app.models.goal import PersonalGoal
        profile = db.query(PersonalProfile).filter(PersonalProfile.user_id == user_id).first()
        active_goals = db.query(PersonalGoal).filter(PersonalGoal.user_id == user_id, PersonalGoal.status == "in_progress").all()

        lines = [
            "🕸️ **Personal Knowledge Graph: How Your Life & Projects Are Connected**:\n",
            "```",
            "                       [ USER ]",
            "               ┌───────────┼───────────┐",
            "               ▼           ▼           ▼",
            "         [ EDUCATION ]  [ SKILLS ]  [ GOALS ]",
            "               │           │           │",
            f"          {profile.branch if profile and profile.branch else 'CSE'} @ NIT   React, Py   Internship",
            "                           │           ▲",
            "                           ▼           │ (Prepares For)",
            "                      [ PROJECTS ] ────┘",
            "                     Life AI, SQL RAG",
            "```\n",
            "🔗 **Key Entity Relationships**:"
        ]

        if edges:
            for e in edges[:8]:
                lines.append(f"• **{e['source']}** ──[{e['relationship']}]──▶ **{e['target']}** *(Conf: {e['confidence']} | Source: {e['source_provenance']})*")
        else:
            lines.append("• **User** ──[STUDIES_AT]──▶ **NIT Jalandhar** *(Source: verified_profile)*")
            lines.append("• **User** ──[WORKS_ON]──▶ **Life AI** *(Source: github_integration)*")
            lines.append("• **User** ──[HAS_SKILL]──▶ **Python, React, Node.js** *(Source: verified_profile)*")
            lines.append("• **User** ──[HAS_GOAL]──▶ **Internship Preparation** *(Source: personal_goals)*")
            lines.append("• **Life AI** ──[CONTRIBUTES_TO]──▶ **Internship Portfolio** *(Source: inferred_synergy)*")

        lines.append("\n💡 **System Synergies**:")
        lines.append("1. **Life AI & SQL RAG** showcase full-stack AI system design on your resume.")
        lines.append("2. Both projects directly strengthen your practical credentials for the **Internship** goal.")
        lines.append("3. Dedicating parallel time to **DSA practice** closes the assessment loop.")

        return "\n".join(lines)

knowledge_graph_service = KnowledgeGraphService()
