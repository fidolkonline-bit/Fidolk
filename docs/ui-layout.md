# Panel layout

A `.panel-heading` only pads the heading. Put form fields, notices, searches,
and other prose in `.panel-body` so they have a consistent 18–20px inset.
Use `.panel-body-search` for a search row above a full-width table.

Do not pad `.panel` itself. Tables and `.table-scroll` span the card width;
their cells provide the required inset. Existing `.form-body`, integrations,
and the POS cart have their own interior spacing and must not be wrapped in
`.panel-body` again. Check empty, error, populated, and narrow-screen states
when adding a panel.
