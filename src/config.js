export function getConfig(environment = process.env) {
  const port = environment.PORT === undefined || environment.PORT === ""
    ? 3000
    : Number(environment.PORT);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a whole number from 1 to 65535");
  }

  return { port };
}
