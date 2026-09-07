import { FormEvent, useEffect, useState } from "react";
import { api, ApiError, Location } from "../lib/api";

export default function Locations() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const locs = await api.getLocations(true);
    setLocations(locs);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !address.trim()) return;
    await api.createLocation({ name: name.trim(), address: address.trim() });
    setName("");
    setAddress("");
    refresh();
  }

  async function toggleFavorite(loc: Location) {
    await api.updateLocation(loc.id, { favorite: !loc.favorite });
    refresh();
  }

  async function toggleActive(loc: Location) {
    if (loc.active) {
      await api.deactivateLocation(loc.id);
    } else {
      await api.updateLocation(loc.id, { active: true });
    }
    refresh();
  }

  function startEdit(loc: Location) {
    setError(null);
    setEditingId(loc.id);
    setEditName(loc.name);
    setEditAddress(loc.address);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: number) {
    if (!editName.trim() || !editAddress.trim()) return;
    setError(null);
    await api.updateLocation(id, { name: editName.trim(), address: editAddress.trim() });
    setEditingId(null);
    refresh();
  }

  async function handleDelete(loc: Location) {
    setError(null);
    const confirmed = window.confirm(
      `Permanently delete "${loc.name}"? This can't be undone. Locations with visit history can't be deleted this way — use Deactivate instead.`
    );
    if (!confirmed) return;

    try {
      await api.deleteLocationPermanent(loc.id);
      refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Couldn't delete this location.");
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Locations</h1>

      <form onSubmit={handleAdd} className="card flex flex-col gap-3">
        <p className="text-sm font-semibold text-slate-300">Add Location</p>
        <input
          className="input"
          placeholder="Name (e.g. Beatty)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="input"
          placeholder="Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <button type="submit" className="btn-secondary">
          Add Location
        </button>
      </form>

      {error && (
        <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : (
        <div className="flex flex-col gap-2">
          {locations.map((loc) => {
            const isEditing = editingId === loc.id;
            return (
              <div key={loc.id} className="card flex flex-col gap-3">
                {isEditing ? (
                  <>
                    <input
                      className="input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Name"
                      autoFocus
                    />
                    <input
                      className="input"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      placeholder="Address"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(loc.id)} className="btn-secondary flex-1">
                        Save
                      </button>
                      <button onClick={cancelEdit} className="btn-secondary flex-1">
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <button
                      onClick={() => startEdit(loc)}
                      className={`flex-1 text-left ${loc.active ? "" : "opacity-50"}`}
                    >
                      <p className="font-medium">
                        {loc.favorite ? "⭐ " : ""}
                        {loc.name}
                      </p>
                      <p className="text-xs text-slate-400">{loc.address}</p>
                    </button>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        onClick={() => toggleFavorite(loc)}
                        className="rounded-lg bg-surfaceInput px-3 py-2 text-sm"
                        title="Toggle favorite"
                      >
                        {loc.favorite ? "★" : "☆"}
                      </button>
                      <button
                        onClick={() => startEdit(loc)}
                        className="rounded-lg bg-surfaceInput px-3 py-2 text-sm"
                        title="Edit"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => toggleActive(loc)}
                        className="rounded-lg bg-surfaceInput px-3 py-2 text-sm"
                        title="Toggle active"
                      >
                        {loc.active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => handleDelete(loc)}
                        className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-400"
                        title="Permanently delete"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {locations.length === 0 && (
            <p className="text-sm text-slate-500">No locations yet — add one above.</p>
          )}
        </div>
      )}
    </div>
  );
}
