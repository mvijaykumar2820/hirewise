import firebase_admin
from firebase_admin import credentials, firestore

def init_firebase():
    if not firebase_admin._apps:
        # Since we are running locally via CLI, Default Credentials apply automatically
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred, {
            'projectId': 'hirewise-agents-ai'
        })

def get_db():
    init_firebase()
    return firestore.client()
