self.addEventListener("push", () => {
  self.registration.showNotification("Fido LK alert", {
    body: "An assigned alert needs attention. Open Fido LK for details.",
    tag: "fido-alert",
    requireInteraction: true,
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url.startsWith(self.location.origin));
      return open ? open.focus() : clients.openWindow("/");
    }),
  );
});
