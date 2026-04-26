from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from supabase import Client, create_client

from main import (
    SUPABASE_KEY,
    SUPABASE_RESERVATIONS_TABLE,
    SUPABASE_RESERVATION_DATETIME_COLUMN,
    SUPABASE_RESERVATION_ID_COLUMN,
    SUPABASE_URL,
    SUPABASE_USER_EMAIL_COLUMN,
    SUPABASE_USER_ID_COLUMN,
    admin_rest_request,
    parse_iso_datetime,
    require_admin,
    require_reservas_manager,
    supabase,
)

router = APIRouter()


class AdminReservaUpdate(BaseModel):
    people: int | None = None
    reservationDatetime: str | None = None
    tables: int | None = None
    user_email: str | None = None


class AdminReservaGroupUpdate(BaseModel):
    ids: list[str]
    people: int | None = None
    reservationDatetime: str | None = None
    tables: list[int] | None = None


class AdminReservaGroupDelete(BaseModel):
    ids: list[str]


class AdminUserUpdate(BaseModel):
    rol: str


def _reservation_id_columns() -> list[str]:
    columns = []
    for col in [SUPABASE_RESERVATION_ID_COLUMN, "id", "reservation_id"]:
        if col and col not in columns:
            columns.append(col)
    return columns


def _find_reservations_by_ids(reservation_ids: list[str]) -> tuple[str, list[dict]]:
    columns = _reservation_id_columns()
    fallback_column = columns[0] if columns else "id"

    for col in columns:
        try:
            response = (
                supabase.table(SUPABASE_RESERVATIONS_TABLE)
                .select("*")
                .in_(col, reservation_ids)
                .execute()
            )
            rows = response.data if isinstance(response.data, list) else []
            if rows:
                return col, rows
        except Exception:
            continue

    return fallback_column, []


def _delete_reservations_by_ids(reservation_ids: list[str]):
    for col in _reservation_id_columns():
        try:
            existing = (
                supabase.table(SUPABASE_RESERVATIONS_TABLE)
                .select(col)
                .in_(col, reservation_ids)
                .limit(1)
                .execute()
            )
            existing_rows = existing.data if isinstance(existing.data, list) else []
            if not existing_rows:
                continue

            response = (
                supabase.table(SUPABASE_RESERVATIONS_TABLE)
                .delete()
                .in_(col, reservation_ids)
                .execute()
            )
            # Supabase puede devolver `data` vacio tras delete aun cuando la operacion fue correcta.
            return response
        except Exception:
            continue

    raise HTTPException(status_code=404, detail="No se encontraron reservas para eliminar")


@router.get("/api/admin/reservas")
def admin_listar_reservas(authorization: str | None = Header(default=None)):
    try:
        require_reservas_manager(authorization)
        read_supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        now_utc = datetime.now(timezone.utc)
        today_start_utc = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)

        respuesta = (
            read_supabase.table(SUPABASE_RESERVATIONS_TABLE)
            .select("*")
            .order(SUPABASE_RESERVATION_DATETIME_COLUMN, desc=True)
            .limit(1000)
            .execute()
        )

        rows = respuesta.data if isinstance(respuesta.data, list) else []
        active_rows = []
        old_ids = []

        for row in rows:
            dt = parse_iso_datetime(row.get(SUPABASE_RESERVATION_DATETIME_COLUMN))
            row_id = row.get(SUPABASE_RESERVATION_ID_COLUMN)

            if row_id is not None and row.get("id") is None:
                row["id"] = row_id

            if dt and dt >= today_start_utc:
                active_rows.append(row)
            elif dt and row_id is not None:
                old_ids.append(row_id)

        if old_ids:
            try:
                supabase.table(SUPABASE_RESERVATIONS_TABLE).delete().in_(SUPABASE_RESERVATION_ID_COLUMN, old_ids).execute()
            except Exception:
                pass

        active_rows.sort(
            key=lambda r: parse_iso_datetime(r.get(SUPABASE_RESERVATION_DATETIME_COLUMN))
            or datetime.min.replace(tzinfo=timezone.utc),
            reverse=False,
        )

        user_ids = {
            str(row.get(SUPABASE_USER_ID_COLUMN)).strip()
            for row in active_rows
            if row.get(SUPABASE_USER_ID_COLUMN) and not row.get("user_email") and not row.get("userEmail")
        }

        if user_ids:
            try:
                users_response = admin_rest_request("GET", "/admin/users?page=1&per_page=1000")
                users = users_response.get("users", []) if isinstance(users_response, dict) else []
                email_by_id = {}

                for user in users:
                    if not isinstance(user, dict):
                        continue
                    user_id = str(user.get("id") or "").strip()
                    user_email = str(user.get("email") or "").strip()
                    if user_id and user_email:
                        email_by_id[user_id] = user_email

                for row in active_rows:
                    if row.get("user_email") or row.get("userEmail"):
                        continue
                    uid = str(row.get(SUPABASE_USER_ID_COLUMN) or "").strip()
                    if uid and uid in email_by_id:
                        row["user_email"] = email_by_id[uid]
            except Exception:
                pass

        return {"ok": True, "data": active_rows}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudieron cargar reservas: {e}")


@router.patch("/api/admin/reservas/{reservation_id}")
def admin_editar_reserva(reservation_id: str, payload: AdminReservaUpdate, authorization: str | None = Header(default=None)):
    try:
        require_reservas_manager(authorization)

        update_data = {}
        if payload.people is not None:
            update_data["people"] = payload.people
        if payload.reservationDatetime:
            update_data[SUPABASE_RESERVATION_DATETIME_COLUMN] = payload.reservationDatetime
        if payload.tables is not None:
            update_data["tables"] = payload.tables
        if payload.user_email is not None and SUPABASE_USER_EMAIL_COLUMN:
            update_data[SUPABASE_USER_EMAIL_COLUMN] = payload.user_email

        if not update_data:
            raise HTTPException(status_code=400, detail="No hay campos para actualizar")

        respuesta = (
            supabase.table(SUPABASE_RESERVATIONS_TABLE)
            .update(update_data)
            .eq(SUPABASE_RESERVATION_ID_COLUMN, reservation_id)
            .execute()
        )

        return {"ok": True, "data": respuesta.data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo editar la reserva: {e}")


@router.delete("/api/admin/reservas/{reservation_id}")
def admin_eliminar_reserva(reservation_id: str, authorization: str | None = Header(default=None)):
    try:
        require_reservas_manager(authorization)
        respuesta = _delete_reservations_by_ids([str(reservation_id).strip()])
        return {"ok": True, "data": respuesta.data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo eliminar la reserva: {e}")


@router.patch("/api/admin/reservas/grupo/update")
def admin_editar_reserva_grupo(payload: AdminReservaGroupUpdate, authorization: str | None = Header(default=None)):
    try:
        require_reservas_manager(authorization)

        reservation_ids = [str(rid).strip() for rid in payload.ids if str(rid).strip()]
        if not reservation_ids:
            raise HTTPException(status_code=400, detail="Debes enviar al menos un id de reserva")

        update_data = {}
        if payload.people is not None:
            update_data["people"] = payload.people
        if payload.reservationDatetime:
            update_data[SUPABASE_RESERVATION_DATETIME_COLUMN] = payload.reservationDatetime

        resolved_id_column, rows = _find_reservations_by_ids(reservation_ids)

        if not rows:
            raise HTTPException(status_code=404, detail="No se encontraron reservas para editar")

        by_id = {
            str(
                row.get(resolved_id_column)
                or row.get(SUPABASE_RESERVATION_ID_COLUMN)
                or row.get("id")
                or row.get("reservation_id")
            ): row
            for row in rows
        }
        ordered_rows = [by_id[rid] for rid in reservation_ids if rid in by_id]
        if not ordered_rows:
            ordered_rows = rows

        if payload.tables is None:
            if not update_data:
                raise HTTPException(status_code=400, detail="No hay campos para actualizar")

            respuesta = (
                supabase.table(SUPABASE_RESERVATIONS_TABLE)
                .update(update_data)
                .in_(resolved_id_column, reservation_ids)
                .execute()
            )
            return {"ok": True, "data": respuesta.data}

        normalized_tables = []
        seen = set()
        for table_id in payload.tables:
            if table_id is None:
                continue
            table_int = int(table_id)
            if table_int < 1 or table_int in seen:
                continue
            seen.add(table_int)
            normalized_tables.append(table_int)

        if not normalized_tables:
            raise HTTPException(status_code=400, detail="Debes indicar al menos una mesa valida")

        for idx, table_id in enumerate(normalized_tables[: len(ordered_rows)]):
            row = ordered_rows[idx]
            row_id = (
                row.get(resolved_id_column)
                or row.get(SUPABASE_RESERVATION_ID_COLUMN)
                or row.get("id")
                or row.get("reservation_id")
            )
            if row_id is None:
                continue

            patch_data = {**update_data, "tables": table_id}
            (
                supabase.table(SUPABASE_RESERVATIONS_TABLE)
                .update(patch_data)
                .eq(resolved_id_column, row_id)
                .execute()
            )

        seed = ordered_rows[0]

        if len(normalized_tables) > len(ordered_rows):
            for table_id in normalized_tables[len(ordered_rows) :]:
                insert_data = {
                    "tables": table_id,
                    "people": update_data.get("people", seed.get("people")),
                    SUPABASE_RESERVATION_DATETIME_COLUMN: update_data.get(
                        SUPABASE_RESERVATION_DATETIME_COLUMN,
                        seed.get(SUPABASE_RESERVATION_DATETIME_COLUMN),
                    ),
                    SUPABASE_USER_ID_COLUMN: seed.get(SUPABASE_USER_ID_COLUMN),
                }

                if SUPABASE_USER_EMAIL_COLUMN:
                    insert_data[SUPABASE_USER_EMAIL_COLUMN] = seed.get(SUPABASE_USER_EMAIL_COLUMN)

                supabase.table(SUPABASE_RESERVATIONS_TABLE).insert(insert_data).execute()

        if len(normalized_tables) < len(ordered_rows):
            extra_ids = [
                row.get(resolved_id_column)
                or row.get(SUPABASE_RESERVATION_ID_COLUMN)
                or row.get("id")
                or row.get("reservation_id")
                for row in ordered_rows[len(normalized_tables) :]
                if (
                    row.get(resolved_id_column)
                    or row.get(SUPABASE_RESERVATION_ID_COLUMN)
                    or row.get("id")
                    or row.get("reservation_id")
                ) is not None
            ]

            if extra_ids:
                (
                    supabase.table(SUPABASE_RESERVATIONS_TABLE)
                    .delete()
                    .in_(resolved_id_column, extra_ids)
                    .execute()
                )

        return {"ok": True, "data": {"updated_ids": reservation_ids, "tables": normalized_tables}}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo editar la reserva en grupo: {e}")


@router.post("/api/admin/reservas/grupo/delete")
def admin_eliminar_reserva_grupo(payload: AdminReservaGroupDelete, authorization: str | None = Header(default=None)):
    try:
        require_reservas_manager(authorization)

        reservation_ids = [str(rid).strip() for rid in payload.ids if str(rid).strip()]
        if not reservation_ids:
            raise HTTPException(status_code=400, detail="Debes enviar al menos un id de reserva")

        respuesta = _delete_reservations_by_ids(reservation_ids)

        return {"ok": True, "data": respuesta.data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo eliminar la reserva en grupo: {e}")


@router.get("/api/admin/users")
def admin_listar_usuarios(authorization: str | None = Header(default=None)):
    try:
        require_admin(authorization)
        response = admin_rest_request("GET", "/admin/users")
        users = response.get("users", []) if isinstance(response, dict) else []

        users = sorted(
            users,
            key=lambda u: (u.get("created_at") if isinstance(u, dict) else getattr(u, "created_at", "")) or "",
            reverse=True,
        )

        normalized = []
        for u in users:
            if isinstance(u, dict):
                metadata = (u.get("user_metadata") or u.get("raw_user_meta_data") or {})
                nombre = str(metadata.get("nombre") or "").strip()
                apellido = str(metadata.get("apellido") or "").strip()
                display_name = str(metadata.get("display_name") or f"{nombre} {apellido}").strip()
                normalized.append(
                    {
                        "id": u.get("id"),
                        "email": u.get("email"),
                        "phone": u.get("phone") or metadata.get("telefono"),
                        "display_name": display_name,
                        "created_at": u.get("created_at"),
                        "rol": (metadata.get("rol") if isinstance(metadata, dict) else None) or "client",
                    }
                )
            else:
                metadata = getattr(u, "user_metadata", {}) or {}
                nombre = str(metadata.get("nombre") or "").strip()
                apellido = str(metadata.get("apellido") or "").strip()
                display_name = str(metadata.get("display_name") or f"{nombre} {apellido}").strip()
                normalized.append(
                    {
                        "id": getattr(u, "id", None),
                        "email": getattr(u, "email", None),
                        "phone": getattr(u, "phone", None) or metadata.get("telefono"),
                        "display_name": display_name,
                        "created_at": getattr(u, "created_at", None),
                        "rol": metadata.get("rol", "client") if isinstance(metadata, dict) else "client",
                    }
                )

        return {"ok": True, "data": normalized}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudieron cargar usuarios: {e}")


@router.patch("/api/admin/users/{user_id}")
def admin_editar_usuario(user_id: str, payload: AdminUserUpdate, authorization: str | None = Header(default=None)):
    try:
        require_admin(authorization)
        rol = payload.rol.strip().lower()
        if rol not in {"admin", "client", "camarero"}:
            raise HTTPException(status_code=400, detail="Rol no valido")

        respuesta = admin_rest_request(
            "PUT",
            f"/admin/users/{user_id}",
            {"user_metadata": {"rol": rol}},
        )

        return {"ok": True, "data": respuesta}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo actualizar el usuario: {e}")


@router.delete("/api/admin/users/{user_id}")
def admin_eliminar_usuario(user_id: str, authorization: str | None = Header(default=None)):
    try:
        require_admin(authorization)
        respuesta = admin_rest_request("DELETE", f"/admin/users/{user_id}")
        return {"ok": True, "data": respuesta}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo eliminar el usuario: {e}")
