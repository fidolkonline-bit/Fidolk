# Arrival alerts and staff access

Create individual staff logins from **Team & payroll → Create user**. Select the **Sales & service** or **Cashier** preset, customize the permission checkboxes, and link the corresponding payroll staff record for commissions. Passwords require at least 12 characters, upper and lower case, a number and a symbol. Keep user management and other owner permissions restricted to trusted administrators.

On each collection device, open Fido LK and click **Enable alarm**. **Test alarm** plays a three-second sample. Sound must be enabled again after a page reload. The volume control adjusts this app's alarm, subject to the device's own volume.

Create an arrival alert and select an active user with Alerts access. The reminder defaults to ten minutes before arrival. A persistent pulsing alarm and workspace-wide alert panel prompt that user to explicitly acknowledge. Merely viewing the notification does not acknowledge it. At expected arrival time an unanswered alert also alarms the owner or alert manager while their app is open. Unassigned alerts are shared.

Acknowledgements save the staff identity and time. Unrelated staff cannot acknowledge another user's assigned alert. A failed save leaves the alarm active; another device's saved acknowledgement is picked up by the ten-second workspace refresh. Multiple active alerts must each be acknowledged. Authorized cancellation also stops the corresponding alarm.

## Background delivery

Continuous sound requires an open, running browser page with audio enabled. Browser suspension, closed pages, device sleep and system notification settings can prevent sound. Background push does not guarantee a continuous alarm.

The existing `/api/jobs` worker must be called by a scheduler using `Authorization: Bearer <CRON_SECRET>` for background escalation, push and queued SMS. Run it every minute for arrival reminders. Configure VAPID keys and register push on the relevant devices; SMS also needs configured gateway credentials. These deployment settings are separate from the in-page alarm. Failed push delivery currently has no durable retry queue. Test background delivery on the actual shop devices before relying on it.
