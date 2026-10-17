-- Demo drug reference data for MedBridge.
-- Ingredient ids are RxNorm concept ids (RxCUI). Brand names are common in Pakistan.
-- Interaction rows are well-known examples for the demo. Before real use, replace
-- them with data loaded from the chosen interaction source (DrugBank / OpenFDA).

insert into public.ingredients (rxcui, name) values
  ('161',   'paracetamol (acetaminophen)'),
  ('1191',  'aspirin'),
  ('5640',  'ibuprofen'),
  ('11289', 'warfarin'),
  ('6809',  'metformin'),
  ('17767', 'amlodipine'),
  ('7646',  'omeprazole'),
  ('32968', 'clopidogrel'),
  ('36567', 'simvastatin'),
  ('21212', 'clarithromycin'),
  ('29046', 'lisinopril'),
  ('9997',  'spironolactone'),
  ('3355',  'diclofenac')
on conflict (rxcui) do nothing;

with products (brand_name, strength, dose_form, ingredient) as (
  values
    ('Panadol',    '500 mg',   'tablet',     '161'),
    ('Calpol',     '120 mg/5 ml', 'syrup',   '161'),
    ('Disprin',    '300 mg',   'tablet',     '1191'),
    ('Brufen',     '400 mg',   'tablet',     '5640'),
    ('Coumadin',   '5 mg',     'tablet',     '11289'),
    ('Glucophage', '500 mg',   'tablet',     '6809'),
    ('Norvasc',    '5 mg',     'tablet',     '17767'),
    ('Risek',      '20 mg',    'capsule',    '7646'),
    ('Plavix',     '75 mg',    'tablet',     '32968'),
    ('Zocor',      '20 mg',    'tablet',     '36567'),
    ('Klaricid',   '500 mg',   'tablet',     '21212'),
    ('Zestril',    '10 mg',    'tablet',     '29046'),
    ('Aldactone',  '25 mg',    'tablet',     '9997'),
    ('Nurofen',    '200 mg',   'tablet',     '5640'),
    ('Voren',      '50 mg',    'tablet',     '3355')
),
inserted as (
  insert into public.drug_products (brand_name, strength, dose_form)
  select brand_name, strength, dose_form from products
  on conflict (brand_name, strength) do update set dose_form = excluded.dose_form
  returning id, brand_name, strength
)
insert into public.product_ingredients (product_id, ingredient_rxcui)
select i.id, p.ingredient
from inserted i
join products p using (brand_name, strength)
on conflict do nothing;

-- least/greatest keeps each pair in the (a < b) order the table requires.
insert into public.drug_interactions (ingredient_a, ingredient_b, severity, description, source)
select least(a, b), greatest(a, b), severity::public.flag_severity, description, 'Demo seed'
from (values
  ('11289', '1191',  'high',     'Warfarin with aspirin raises the risk of serious bleeding.'),
  ('11289', '5640',  'high',     'Warfarin with ibuprofen raises the risk of serious bleeding.'),
  ('36567', '21212', 'high',     'Clarithromycin raises simvastatin levels, risking muscle damage.'),
  ('1191',  '5640',  'moderate', 'Ibuprofen can reduce the protective effect of low-dose aspirin and adds stomach bleeding risk.'),
  ('32968', '7646',  'moderate', 'Omeprazole can make clopidogrel less effective.'),
  ('29046', '9997',  'moderate', 'Lisinopril with spironolactone can raise potassium to unsafe levels.'),
  -- Arthritis painkillers (NSAIDs) with blood pressure medicines: the multi-doctor
  -- example in final_idea.md. Illustrative; have a doctor check before presenting.
  ('5640',  '29046', 'moderate', 'Ibuprofen can raise blood pressure, weaken the effect of lisinopril and, taken together, strain the kidneys.'),
  ('3355',  '29046', 'moderate', 'Diclofenac can raise blood pressure, weaken the effect of lisinopril and, taken together, strain the kidneys.'),
  ('5640',  '17767', 'low',      'Ibuprofen can raise blood pressure and make amlodipine less effective.'),
  ('3355',  '17767', 'low',      'Diclofenac can raise blood pressure and make amlodipine less effective.')
) as t (a, b, severity, description)
on conflict (ingredient_a, ingredient_b) do nothing;
