import { z } from "zod";

export function createUsernameSchema(usernameFromQuery?: string) {
  if (usernameFromQuery) {
    return z.string().min(1).optional();
  }

  return z.string().min(1);
}

export function createUserSchema(usernameFromQuery?: string) {
  if (usernameFromQuery) {
    return z.string().min(1).optional();
  }

  return z.string().min(1);
}
