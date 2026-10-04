import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.profile import PersonalProfile
from app.services.web_search_service import web_search_service

logger = logging.getLogger("life.web_research")

class WebResearchAgent:
    """
    Web Research Agent:
    - Executes live web searches for opportunities, tech updates, or research topics.
    - Filters and compares opportunities against the user's verified skills and profile.
    - Grounded citations: Never fabricates current facts without actual web results.
    """

    def research_internships(
        self,
        db: Session,
        user_id: str,
        role_keyword: Optional[str] = "software engineer"
    ) -> Dict[str, Any]:
        """
        Search for internships and match against user profile skills.
        """
        # Fetch user profile to match skills
        profile = db.query(PersonalProfile).filter(PersonalProfile.user_id == user_id).first()
        skills = profile.skills if (profile and profile.skills) else ["Python", "React", "Web Development"]

        # Build search query
        query = f"latest {role_keyword} internship hiring 2026 India remote"
        search_results = web_search_service.search_duckduckgo(query, max_results=5)

        # Match results against skills
        matched_items = []
        for res in search_results:
            title = res.get("title", "")
            snippet = res.get("snippet", "")
            url = res.get("url", "")
            
            matched_skills = [s for s in skills if s.lower() in (title + " " + snippet).lower()]
            
            matched_items.append({
                "title": title,
                "url": url,
                "snippet": snippet,
                "matching_skills": matched_skills,
                "match_score": len(matched_skills)
            })

        # Sort by best match
        matched_items.sort(key=lambda x: x["match_score"], reverse=True)

        return {
            "query": query,
            "user_skills_evaluated": skills,
            "opportunities_found": len(matched_items),
            "results": matched_items
        }

    def format_internship_response(self, db: Session, user_id: str, role_keyword: Optional[str] = "software engineer") -> str:
        """Human-formatted research response with verified web citations."""
        data = self.research_internships(db, user_id, role_keyword)
        skills_str = ", ".join(data["user_skills_evaluated"][:4])

        lines = [f"🌐 Web Research: Latest {role_keyword.title()} Opportunities (Matched with your skills: {skills_str}):\n"]

        if not data["results"]:
            return f"Web search par koi active listing nahi mili. Kripya query refine karein."

        for i, item in enumerate(data["results"][:4], 1):
            lines.append(f"{i}. **[{item['title']}]({item['url']})**")
            lines.append(f"   • Summary: {item['snippet']}")
            if item["matching_skills"]:
                lines.append(f"   • Matching Skills: {', '.join(item['matching_skills'])}")
            lines.append("")

        lines.append("Tip: In roles ke requirements ke hisaab se resume update karke apply karein!")
        return "\n".join(lines)

web_research_agent = WebResearchAgent()
