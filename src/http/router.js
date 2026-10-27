function compilePath(path) {
  if (typeof path !== "string" || !path.startsWith("/")) {
    throw new TypeError("Route paths must be strings starting with /");
  }

  const names = [];
  const segments = path.split("/").map((segment) => {
    if (segment.startsWith(":")) {
      const name = segment.slice(1);
      if (!name || names.includes(name)) {
        throw new TypeError("Route parameter names must be non-empty and unique");
      }
      names.push(name);
      return "([^/]+)";
    }
    return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  });

  return {
    names,
    pattern: new RegExp(`^${segments.join("/")}/?$`),
  };
}

export function createRouter() {
  const routes = [];

  return {
    add(method, path, handler) {
      if (typeof method !== "string" || !method.trim()) {
        throw new TypeError("Route method must be a non-empty string");
      }
      if (typeof handler !== "function") {
        throw new TypeError("Route handler must be a function");
      }
      const compiled = compilePath(path);
      routes.push({
        method: method.toUpperCase(),
        path,
        handler,
        ...compiled,
      });
      return this;
    },

    match(method, pathname) {
      const requestMethod = method.toUpperCase();
      for (const route of routes) {
        if (route.method !== requestMethod) continue;
        const match = route.pattern.exec(pathname);
        if (!match) continue;

        const params = {};
        route.names.forEach((name, index) => {
          params[name] = decodeURIComponent(match[index + 1]);
        });
        return { handler: route.handler, params };
      }
      return undefined;
    },
  };
}
