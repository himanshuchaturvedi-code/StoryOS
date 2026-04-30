-- Function to check ActivityPlan / ActivityDay inserts and updates
CREATE OR REPLACE FUNCTION check_activity_location_region()
RETURNS TRIGGER AS $$
DECLARE
  region_code TEXT;
BEGIN
  SELECT "incentiveRegionCode" INTO region_code FROM "locations" WHERE "id" = NEW."locationId";
  IF region_code IS NULL THEN
    RAISE EXCEPTION 'Location used in activity (id: %) must have an incentiveRegionCode', NEW."locationId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_activity_plan_location
BEFORE INSERT OR UPDATE OF "locationId" ON "activity_plans"
FOR EACH ROW EXECUTE FUNCTION check_activity_location_region();

CREATE TRIGGER trg_check_activity_day_location
BEFORE INSERT OR UPDATE OF "locationId" ON "activity_days"
FOR EACH ROW EXECUTE FUNCTION check_activity_location_region();

-- Function to check Location updates
CREATE OR REPLACE FUNCTION check_location_region_in_use()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."incentiveRegionCode" IS NULL AND OLD."incentiveRegionCode" IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM "activity_plans" WHERE "locationId" = NEW."id" AND "deletedAt" IS NULL) THEN
      RAISE EXCEPTION 'Cannot remove incentiveRegionCode from location (id: %) because it is used in an Activity Plan', NEW."id";
    END IF;
    IF EXISTS (SELECT 1 FROM "activity_days" WHERE "locationId" = NEW."id" AND "deletedAt" IS NULL) THEN
      RAISE EXCEPTION 'Cannot remove incentiveRegionCode from location (id: %) because it is used in an Activity Day', NEW."id";
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_location_region_in_use
BEFORE UPDATE OF "incentiveRegionCode" ON "locations"
FOR EACH ROW EXECUTE FUNCTION check_location_region_in_use();
