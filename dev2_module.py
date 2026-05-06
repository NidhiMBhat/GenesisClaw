from sentence_transformers import SentenceTransformer
import chromadb
import uuid
import sys
import json
import requests


def extract_keywords(text):
    text = text.lower()

    if "privacy" in text:
        return "ai privacy security"

    if "cost" in text or "computational" in text:
        return "efficient ai model optimization"

    if "real-time" in text:
        return "real time ai inference edge ai"

    if "energy" in text:
        return "energy efficient ai deep learning"

    return "machine learning ai project"


def search_github_repos(query):

    url = "https://api.github.com/search/repositories"

    params = {
        "q": query,
        "sort": "stars",
        "order": "desc",
        "per_page": 3
    }

    headers = {
        "User-Agent": "Mozilla/5.0"
    }

    response = requests.get(url, params=params, headers=headers)

    if response.status_code != 200:
        return []

    data = response.json()

    repos = []

    for item in data.get("items", [])[:3]:

        repos.append({
            "name": item["name"],
            "url": item["html_url"]
        })

    return repos

# Load embedding model
model = SentenceTransformer('all-MiniLM-L6-v2')

# Initialize ChromaDB
client = chromadb.Client()
collection = client.get_or_create_collection(name="research_gaps")


def process_gaps(gaps):
    output = []

    for gap in gaps:

        # Dev3 sends objects like:
        # { "gap_text": "...", "keywords": [...] }

        gap_text = gap["gap_text"]
        keywords = gap.get("keywords", [])

        # Create embedding
        embedding = model.encode(gap_text)

        # Search existing similar gaps
        results = collection.query(
            query_embeddings=[embedding.tolist()],
            n_results=1
        )

        found = False
        count = 1

        # Check similarity
        if results["ids"] and len(results["ids"][0]) > 0:

            distance = results["distances"][0][0]

            # Similar gap exists
            if distance < 0.8:

                found = True

                existing_id = results["ids"][0][0]
                metadata = results["metadatas"][0][0]

                count = metadata.get("count", 1) + 1

                # Update count
                collection.delete(ids=[existing_id])

                collection.add(
                    documents=[gap_text],
                    embeddings=[embedding.tolist()],
                    ids=[existing_id],
                    metadatas=[{"count": count}]
                )

        # New gap
        if not found:

            collection.add(
                documents=[gap_text],
                embeddings=[embedding.tolist()],
                ids=[str(uuid.uuid4())],
                metadatas=[{"count": 1}]
            )

        # Add to output
        query = extract_keywords(gap_text)

        repos = search_github_repos(query)

        output.append({
         "gap_text": gap_text,
         "keywords": keywords,
         "count": count,
         "github_projects": repos
              })

    return output


if __name__ == "__main__":

    # Receive gaps from Node.js
    gaps = json.loads(sys.argv[1])

    # Process them
    result = process_gaps(gaps)

    # Send back to Node.js
    print(json.dumps(result))