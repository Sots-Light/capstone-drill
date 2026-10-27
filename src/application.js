import { createMemoryRepository } from "./repositories/memory.js";
import { createBookingService } from "./services/bookingService.js";
import { createEventService } from "./services/eventService.js";
import { createMockPaymentGateway } from "./lib/mockPaymentGateway.js";
import { createApiRouter } from "./http/apiRoutes.js";
import { createApp } from "./http/app.js";

export function createApplication({
  repository = createMemoryRepository(),
  paymentGateway = createMockPaymentGateway(),
  publicDir,
} = {}) {
  const eventService = createEventService(repository);
  const bookingService = createBookingService(repository, paymentGateway);
  const router = createApiRouter({ eventService, bookingService });
  const server = createApp(publicDir === undefined ? { router } : { router, publicDir });
  return { server, repository };
}
