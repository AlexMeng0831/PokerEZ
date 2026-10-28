import type { ClientCommand, GuestAction } from "./protocol.js";
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const keys = (v: Record<string, unknown>, allowed: string[]) =>
  Object.keys(v).every((k) => allowed.includes(k));
export function parseCommand(value: unknown): ClientCommand | null {
  if (
    !object(value) ||
    typeof value.requestId !== "string" ||
    !/^[A-Za-z0-9_-]{8,80}$/.test(value.requestId)
  )
    return null;
  const requestId = value.requestId;
  if (
    value.type === "create" &&
    keys(value, [
      "requestId",
      "type",
      "name",
      "capacity",
      "smallBlind",
      "bigBlind",
    ])
  ) {
    const { name, capacity, smallBlind, bigBlind } = value;
    if (
      typeof name !== "string" ||
      name.trim().length < 1 ||
      name.length > 40 ||
      typeof capacity !== "number" ||
      !Number.isInteger(capacity) ||
      capacity < 2 ||
      capacity > 6 ||
      typeof smallBlind !== "number" ||
      typeof bigBlind !== "number" ||
      !Number.isSafeInteger(smallBlind) ||
      !Number.isSafeInteger(bigBlind) ||
      smallBlind < 1 ||
      bigBlind < smallBlind ||
      bigBlind > 100
    )
      return null;
    return {
      requestId,
      type: "create",
      name: name.trim(),
      capacity,
      smallBlind,
      bigBlind,
    };
  }
  if (
    value.type === "join" &&
    keys(value, ["requestId", "type", "code"]) &&
    typeof value.code === "string" &&
    /^[A-Z0-9]{6}$/.test(value.code)
  )
    return { requestId, type: "join", code: value.code };
  if (
    (value.type === "start" ||
      value.type === "leave" ||
      value.type === "topup") &&
    keys(value, ["requestId", "type"])
  )
    return { requestId, type: value.type };
  if (
    value.type === "action" &&
    keys(value, ["requestId", "type", "revision", "handId", "action"]) &&
    Number.isSafeInteger(value.revision) &&
    typeof value.revision === "number" &&
    value.revision >= 0 &&
    typeof value.handId === "string" &&
    value.handId.length <= 100 &&
    object(value.action)
  ) {
    const a = value.action;
    let action: GuestAction;
    if (
      (a.type === "BET" || a.type === "RAISE_TO") &&
      keys(a, ["type", "to"]) &&
      typeof a.to === "number" &&
      Number.isSafeInteger(a.to) &&
      a.to > 0
    )
      action = { type: a.type, to: a.to };
    else if (
      ["FOLD", "CHECK", "CALL", "ALL_IN"].includes(String(a.type)) &&
      keys(a, ["type"])
    )
      action = { type: a.type as "FOLD" | "CHECK" | "CALL" | "ALL_IN" };
    else return null;
    return {
      requestId,
      type: "action",
      revision: value.revision,
      handId: value.handId,
      action,
    };
  }
  return null;
}
