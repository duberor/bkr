# QA Stabilization Report

## Fixed in this version

- Added inline validation for the consumer form.
- Added inline validation for zone creation.
- Added inline validation for system settings numeric fields.
- Unified locale number parsing via `src/utils/number.js`.
- Prevented deleting zones that still contain devices.
- Added global "Clear all" action with confirmation.
- Improved custom select accessibility and keyboard behavior.
- Preserved localStorage behavior for consumers, zones, and system settings.
- Kept rendering of user text escaped.

## Manual scenarios covered

- Add zone -> add device -> reload page.
- Invalid consumer form submit.
- Invalid zone create submit.
- Duplicate zone create.
- Delete empty zone.
- Attempt to delete non-empty zone.
- Clear consumers.
- Clear all project data.
- Decimal input with comma and dot.
