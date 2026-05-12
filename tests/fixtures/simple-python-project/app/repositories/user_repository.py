class UserRepository:
    def find_by_email(self, email: str) -> dict:
        return {"email": email}
