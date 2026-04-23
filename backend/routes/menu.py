from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from main import SUPABASE_MENU_TABLE, menu_supabase_client, normalize_menu_item, require_admin

router = APIRouter()


class MenuItemPayload(BaseModel):
    category: str
    name: str
    description: str
    price: str
    badge: str = ""
    sort_order: int | None = None


class MenuItemUpdatePayload(BaseModel):
    category: str | None = None
    name: str | None = None
    description: str | None = None
    price: str | None = None
    badge: str | None = None
    sort_order: int | None = None


@router.get("/api/menu")
def listar_menu():
    try:
        menu_supabase = menu_supabase_client()
        response = menu_supabase.table(SUPABASE_MENU_TABLE).select("*").execute()

        rows = response.data if isinstance(response.data, list) else []
        categories = {
            "starters": [],
            "mains": [],
            "desserts": [],
            "wines": [],
        }

        for index, row in enumerate(rows):
            if not isinstance(row, dict):
                continue

            item = normalize_menu_item(row)
            item["_order_index"] = item["sort_order"] if item.get("sort_order") is not None else index
            category = item["category"]
            if category not in categories:
                continue

            if item["name"]:
                categories[category].append(item)

        for category_key in categories:
            categories[category_key].sort(
                key=lambda item: ((item.get("_order_index") or 0), str(item.get("name") or "").lower())
            )

        return {"ok": True, "data": categories}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo cargar el menu: {e}")


@router.post("/api/admin/menu")
def admin_crear_menu_item(payload: MenuItemPayload, authorization: str | None = Header(default=None)):
    try:
        require_admin(authorization)
        menu_supabase = menu_supabase_client()

        category = str(payload.category or "").strip().lower()
        name = str(payload.name or "").strip()
        description = str(payload.description or "").strip()
        price = str(payload.price or "").strip()
        badge = str(payload.badge or "").strip()
        sort_order = payload.sort_order

        if category not in {"starters", "mains", "desserts", "wines"}:
            raise HTTPException(status_code=400, detail="Categoria no valida")
        if not name or not description or not price:
            raise HTTPException(status_code=400, detail="Nombre, descripcion y precio son obligatorios")
        if sort_order is not None and sort_order < 0:
            raise HTTPException(status_code=400, detail="sort_order debe ser mayor o igual a 0")

        respuesta = (
            menu_supabase.table(SUPABASE_MENU_TABLE)
            .insert(
                {
                    "category": category,
                    "name": name,
                    "description": description,
                    "price": price,
                    "badge": badge,
                    "sort_order": sort_order,
                }
            )
            .execute()
        )

        return {"ok": True, "data": respuesta.data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo crear el plato: {e}")


@router.patch("/api/admin/menu/{item_id}")
def admin_editar_menu_item(item_id: str, payload: MenuItemUpdatePayload, authorization: str | None = Header(default=None)):
    try:
        require_admin(authorization)
        menu_supabase = menu_supabase_client()

        update_data = {}
        if payload.category is not None:
            category = str(payload.category or "").strip().lower()
            if category not in {"starters", "mains", "desserts", "wines"}:
                raise HTTPException(status_code=400, detail="Categoria no valida")
            update_data["category"] = category
        if payload.name is not None:
            name = str(payload.name or "").strip()
            if not name:
                raise HTTPException(status_code=400, detail="Nombre invalido")
            update_data["name"] = name
        if payload.description is not None:
            description = str(payload.description or "").strip()
            if not description:
                raise HTTPException(status_code=400, detail="Descripcion invalida")
            update_data["description"] = description
        if payload.price is not None:
            price = str(payload.price or "").strip()
            if not price:
                raise HTTPException(status_code=400, detail="Precio invalido")
            update_data["price"] = price
        if payload.badge is not None:
            update_data["badge"] = str(payload.badge or "").strip()
        if payload.sort_order is not None:
            if payload.sort_order < 0:
                raise HTTPException(status_code=400, detail="sort_order debe ser mayor o igual a 0")
            update_data["sort_order"] = payload.sort_order

        if not update_data:
            raise HTTPException(status_code=400, detail="No hay campos para actualizar")

        respuesta = menu_supabase.table(SUPABASE_MENU_TABLE).update(update_data).eq("id", item_id).execute()
        return {"ok": True, "data": respuesta.data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo editar el plato: {e}")


@router.delete("/api/admin/menu/{item_id}")
def admin_eliminar_menu_item(item_id: str, authorization: str | None = Header(default=None)):
    try:
        require_admin(authorization)
        menu_supabase = menu_supabase_client()
        respuesta = menu_supabase.table(SUPABASE_MENU_TABLE).delete().eq("id", item_id).execute()
        return {"ok": True, "data": respuesta.data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo eliminar el plato: {e}")
