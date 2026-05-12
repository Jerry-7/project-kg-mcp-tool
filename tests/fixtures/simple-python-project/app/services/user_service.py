from app.repositories.user_repository import UserRepository


class UserService:
    def __init__(self) -> None:
        self.repository = UserRepository()

    def login(self, email: str, password: str) -> dict:
        user = self.repository.find_by_email(email)
        return {"user": user, "password": password}
