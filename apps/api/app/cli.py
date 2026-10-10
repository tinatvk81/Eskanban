"""Operator commands (run on the server): provision agencies and reset passwords.

    python -m app.cli create-agency --name "Sunrise Realty" --slug sunrise --plan small \
        --seats 3 --manager-name "Ali Rezaei" --manager-phone 09121234567
    python -m app.cli set-password --phone 09121234567

Passwords are always typed at a hidden prompt, never passed as arguments.
"""

import argparse
import getpass
import sys

from app.core.errors import DomainError, InvalidInput
from app.core.phone import normalize_phone
from app.db.models import Plan, User
from app.db.session import system_session
from app.services.agencies import create_agency
from app.services.auth import reset_password


def _prompt_password() -> str:
    first = getpass.getpass("Temporary password: ")
    if first != getpass.getpass("Repeat password: "):
        raise InvalidInput("passwords do not match")
    return first


def cmd_create_agency(args: argparse.Namespace, password: str) -> str:
    with system_session() as session:
        agency, manager = create_agency(
            session,
            name=args.name,
            slug=args.slug,
            plan=Plan(args.plan),
            seat_limit=args.seats,
            manager_phone=args.manager_phone,
            manager_name=args.manager_name,
            manager_password=password,
            manager_email=args.manager_email,
        )
        session.commit()
        return f"Created agency '{agency.slug}' with manager {manager.phone}"


def cmd_set_password(args: argparse.Namespace, password: str) -> str:
    from sqlalchemy import select

    with system_session() as session:
        user = session.scalar(select(User).where(User.phone == normalize_phone(args.phone)))
        if user is None:
            raise InvalidInput("no user with this mobile number")
        reset_password(session, user.id, new_password=password)
        session.commit()
        return f"Password reset for {user.phone}; they must change it at next login"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="app.cli")
    sub = parser.add_subparsers(dest="command", required=True)

    create = sub.add_parser("create-agency", help="create an agency and its first manager")
    create.add_argument("--name", required=True)
    create.add_argument("--slug", required=True)
    create.add_argument("--plan", choices=[p.value for p in Plan], required=True)
    create.add_argument("--seats", type=int, required=True)
    create.add_argument("--manager-name", required=True)
    create.add_argument("--manager-phone", required=True)
    create.add_argument("--manager-email")
    create.set_defaults(func=cmd_create_agency)

    reset = sub.add_parser("set-password", help="set a temporary password for a user")
    reset.add_argument("--phone", required=True)
    reset.set_defaults(func=cmd_set_password)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        print(args.func(args, _prompt_password()))
    except DomainError as exc:
        print(f"error ({exc.code}): {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
