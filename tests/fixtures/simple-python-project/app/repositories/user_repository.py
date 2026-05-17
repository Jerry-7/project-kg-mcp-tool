class UserRepository:
    def find_by_email(self, email: str) -> dict:
        """Load a user record by email."""
        return {"email": email}
