/** Runs once when the server starts. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Node gives up on each connection attempt after 250 ms, before trying the
  // next address. Some outside APIs (openFDA) take ~300 ms to connect from
  // some hosts, so every attempt was cut off and the FDA label check silently
  // found nothing. 1 s still falls back quickly when an address is dead.
  const net = await import("node:net");
  net.setDefaultAutoSelectFamilyAttemptTimeout(1000);
}
