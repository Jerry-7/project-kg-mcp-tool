from app.services.user_service import UserService


def main() -> None:
    service = UserService()
    service.login("demo@example.com", "secret")


if __name__ == "__main__":
    main()
