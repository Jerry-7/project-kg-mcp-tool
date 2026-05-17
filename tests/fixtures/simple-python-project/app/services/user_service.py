from app.repositories.user_repository import UserRepository


# Coordinates user authentication.
class UserService:
    """Application service for user login."""

    def __init__(self) -> None:
        self.repository = UserRepository()

    def login(self, email: str, password: str) -> dict:
        """Validate credentials and return login data."""
        user = self.repository.find_by_email(email)
        return {"user": user, "password": password}
