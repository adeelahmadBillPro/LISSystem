"""Create initial admin user for the LIS system."""

from backend.database.models import create_tables, User
from backend.database.connection import SessionLocal
from backend.auth import hash_password


def seed():
    create_tables()
    db = SessionLocal()

    if not db.query(User).filter(User.username == "admin").first():
        admin = User(
            username="admin",
            password_hash=hash_password("admin123"),
            full_name="System Administrator",
            role="admin",
        )
        db.add(admin)
        db.commit()
        print("Admin user created: admin / admin123")
    else:
        print("Admin user already exists")

    db.close()


if __name__ == "__main__":
    seed()
