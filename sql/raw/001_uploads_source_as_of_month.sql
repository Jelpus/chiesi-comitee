ALTER TABLE `chiesi-committee.chiesi_committee_raw.uploads`
ADD COLUMN IF NOT EXISTS source_as_of_month DATE;
