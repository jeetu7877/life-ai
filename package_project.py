import os
import zipfile

def zip_project(source_dir, output_zip_path):
    print(f"Creating zip file: {output_zip_path} from {source_dir}...")
    exclude_dirs = {'node_modules', '__pycache__', '.git', 'chroma_db', 'uploads', '.pytest_cache'}
    exclude_extensions = {'.pyc', '.pyo', '.db', '.sqlite'}

    with zipfile.ZipFile(output_zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(source_dir):
            # Exclude specified directories
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            
            for file in files:
                ext = os.path.splitext(file)[1]
                if ext in exclude_extensions:
                    continue
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, os.path.dirname(source_dir))
                zipf.write(file_path, rel_path)
                print(f"Added: {rel_path}")

    print(f"\nSuccessfully created: {output_zip_path}")

if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    zip_path = os.path.join(parent_dir, "jeet-ai.zip")
    zip_project(current_dir, zip_path)
