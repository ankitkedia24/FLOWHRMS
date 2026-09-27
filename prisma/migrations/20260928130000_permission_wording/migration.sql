-- No "tenant" on screen: the one permission that said it.
UPDATE "permissions" SET "name" = 'Edit company rules and shifts' WHERE "key" = 'policy.edit' AND "name" = 'Edit tenant policies';
