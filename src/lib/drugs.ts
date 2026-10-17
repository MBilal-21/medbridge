import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type Admin = ReturnType<typeof createAdminClient>;
type Severity = Database["public"]["Enums"]["flag_severity"];
type FlagType = Database["public"]["Enums"]["flag_type"];

const RXNAV = "https://rxnav.nlm.nih.gov/REST";
const OPENFDA = "https://api.fda.gov/drug/label.json";

export const SOURCE_RXNORM = "RxNorm (US National Library of Medicine)";
export const SOURCE_OPENFDA = "FDA drug label (openFDA)";

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // A slow or failing outside service must not break the check; the medicine
    // is then flagged as unclear for the doctor instead.
    return null;
  }
}

type RxProperties = { properties?: { rxcui: string; name: string; tty: string } };
type RxRelated = {
  relatedGroup?: { conceptGroup?: { tty: string; conceptProperties?: { rxcui: string; name: string }[] }[] };
};

/** Finds the RxNorm concept for a name, accepting only matches that really carry that name. */
async function findRxcui(name: string): Promise<{ rxcui: string; name: string; tty: string } | null> {
  const exact = await getJson<{ idGroup?: { rxnormId?: string[] } }>(
    `${RXNAV}/rxcui.json?name=${encodeURIComponent(name)}&search=2`,
  );
  const candidates = exact?.idGroup?.rxnormId ?? [];

  if (!candidates.length) {
    const approx = await getJson<{ approximateGroup?: { candidate?: { rxcui: string }[] } }>(
      `${RXNAV}/approximateTerm.json?term=${encodeURIComponent(name)}&maxEntries=3`,
    );
    candidates.push(...new Set(approx?.approximateGroup?.candidate?.map((c) => c.rxcui) ?? []));
  }

  // Fuzzy search returns something for almost any word (e.g. "Risek" -> "Rise Prot-72"),
  // so the concept's own name must contain the first word that was written.
  const firstWord = name.toLowerCase().split(/\s+/)[0];
  for (const rxcui of candidates) {
    const props = (await getJson<RxProperties>(`${RXNAV}/rxcui/${rxcui}/properties.json`))?.properties;
    if (props && props.name.toLowerCase().includes(firstWord)) return props;
  }
  return null;
}

async function rxIngredients(concept: { rxcui: string; name: string; tty: string }) {
  if (concept.tty === "IN") return [{ rxcui: concept.rxcui, name: concept.name }];
  const related = await getJson<RxRelated>(`${RXNAV}/rxcui/${concept.rxcui}/related.json?tty=IN`);
  return (related?.relatedGroup?.conceptGroup ?? [])
    .flatMap((g) => g.conceptProperties ?? [])
    .map(({ rxcui, name }) => ({ rxcui, name }));
}

/**
 * Maps a medicine name as written to a drug product with known active ingredients.
 * Uses the MedBridge list first (local brands), then RxNorm, and saves RxNorm
 * matches so the next lookup is local. Returns null when no source knows the name.
 */
export async function matchProduct(admin: Admin, nameAsWritten: string, strength?: string | null) {
  const name = nameAsWritten.trim().replace(/\s+/g, " ");
  if (!name) return null;
  const brand = name.split(" ")[0];

  // Only products with known ingredients count; others are retried against RxNorm.
  const { data: local } = await admin
    .from("drug_products")
    .select("id, strength, product_ingredients!inner(ingredient_rxcui)")
    .or(`brand_name.ilike.${escapeLike(name)},brand_name.ilike.${escapeLike(brand)}`);
  if (local?.length) {
    const wanted = strength?.replace(/\s/g, "").toLowerCase();
    return (local.find((p) => p.strength?.replace(/\s/g, "").toLowerCase() === wanted) ?? local[0]).id;
  }

  const concept = (await findRxcui(name)) ?? (brand !== name ? await findRxcui(brand) : null);
  if (!concept) return null;
  const ingredients = await rxIngredients(concept);
  if (!ingredients.length) return null;

  const { error: ingredientError } = await admin
    .from("ingredients")
    .upsert(ingredients, { onConflict: "rxcui", ignoreDuplicates: true });
  if (ingredientError) return null;
  const { data: product } = await admin
    .from("drug_products")
    .upsert(
      {
        brand_name: concept.tty === "BN" ? concept.name : brand,
        strength: strength?.trim() || null,
        rxcui: concept.rxcui,
      },
      { onConflict: "brand_name,strength" },
    )
    .select("id")
    .single();
  if (!product) return null;
  const { error: linkError } = await admin
    .from("product_ingredients")
    .upsert(
      ingredients.map((i) => ({ product_id: product.id, ingredient_rxcui: i.rxcui })),
      { ignoreDuplicates: true },
    );
  return linkError ? null : product.id;
}

function escapeLike(value: string) {
  // Quote for PostgREST's or=() syntax and escape LIKE wildcards.
  return `"${value.replace(/[\\%_]/g, (c) => `\\${c}`).replace(/"/g, '\\"')}"`;
}

/** "paracetamol (acetaminophen)" -> "acetaminophen", the US name FDA labels use. */
function usName(ingredientName: string) {
  return (ingredientName.match(/\(([^)]+)\)/)?.[1] ?? ingredientName).toLowerCase();
}

type LabelHit = { severity: Severity; description: string; source: string };

/** Looks for one ingredient by name in the drug-interactions section of the other's FDA label. */
async function fdaLabelMention(a: string, b: string): Promise<LabelHit | null> {
  for (const [label, other] of [
    [a, b],
    [b, a],
  ]) {
    const data = await getJson<{ results?: { drug_interactions?: string[] }[] }>(
      `${OPENFDA}?search=openfda.generic_name:"${encodeURIComponent(label)}"+AND+_exists_:drug_interactions&limit=1`,
    );
    const text = data?.results?.[0]?.drug_interactions?.join(" ") ?? "";
    const at = text.toLowerCase().search(new RegExp(`\\b${other.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`));
    if (at === -1) continue;
    const start = Math.max(0, text.lastIndexOf(".", at) + 1);
    const end = text.indexOf(".", at);
    const sentence = text.slice(start, end === -1 ? undefined : end + 1).trim().slice(0, 400);
    return {
      severity: "low",
      description: `The FDA label for ${label} lists ${other} under drug interactions: "${sentence}"`,
      source: SOURCE_OPENFDA,
    };
  }
  return null;
}

export type NewFlag = {
  type: FlagType;
  severity: Severity;
  medication_a_id: string;
  medication_b_id: string | null;
  ingredient_rxcui: string | null;
  source: string;
  /** Database finding in words, given to the AI to explain. Not stored. */
  finding: string;
  medicines: string[];
};

/**
 * Checks a patient's full active medicine list with fixed rules: shared active
 * ingredients are duplicates, and ingredient pairs are looked up in the
 * interaction table, then in FDA labels. No AI is involved in finding problems.
 */
export async function findProblems(admin: Admin, patientId: string) {
  const { data: meds } = await admin
    .from("medications")
    .select(
      "id, name_as_written, drug_products(brand_name, product_ingredients(ingredient_rxcui, ingredients(name)))",
    )
    .eq("patient_id", patientId)
    .eq("status", "active");

  const list = (meds ?? []).map((m) => ({
    id: m.id,
    label: m.drug_products?.brand_name ?? m.name_as_written,
    ingredients: (m.drug_products?.product_ingredients ?? []).map((pi) => ({
      rxcui: pi.ingredient_rxcui,
      name: pi.ingredients?.name ?? pi.ingredient_rxcui,
    })),
  }));

  const flags: NewFlag[] = [];
  const pairs = new Map<string, { a: (typeof list)[number]; b: (typeof list)[number]; x: string; y: string }>();
  const names = new Map(list.flatMap((m) => m.ingredients.map((i) => [i.rxcui, i.name] as const)));

  for (const m of list) {
    if (!m.ingredients.length) {
      flags.push({
        type: "unclear",
        severity: "low",
        medication_a_id: m.id,
        medication_b_id: null,
        ingredient_rxcui: null,
        source: `Not found in the MedBridge drug list or ${SOURCE_RXNORM}`,
        finding: `${m.label} could not be matched to an active ingredient, so it was not checked for duplicates or interactions.`,
        medicines: [m.label],
      });
    }
  }

  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      for (const ia of a.ingredients) {
        for (const ib of b.ingredients) {
          if (ia.rxcui === ib.rxcui) {
            flags.push({
              type: "duplicate",
              severity: "moderate",
              medication_a_id: a.id,
              medication_b_id: b.id,
              ingredient_rxcui: ia.rxcui,
              source: SOURCE_RXNORM,
              finding: `${a.label} and ${b.label} both contain ${ia.name}. Taking both doubles the dose.`,
              medicines: [a.label, b.label],
            });
          } else {
            const [x, y] = ia.rxcui < ib.rxcui ? [ia.rxcui, ib.rxcui] : [ib.rxcui, ia.rxcui];
            if (!pairs.has(`${x}|${y}`)) pairs.set(`${x}|${y}`, { a, b, x, y });
          }
        }
      }
    }
  }

  if (pairs.size) {
    const ids = [...names.keys()];
    const { data: known } = await admin
      .from("drug_interactions")
      .select("ingredient_a, ingredient_b, severity, description, source")
      .in("ingredient_a", ids)
      .in("ingredient_b", ids);
    const knownMap = new Map(known?.map((k) => [`${k.ingredient_a}|${k.ingredient_b}`, k]));

    const results = await Promise.all(
      [...pairs.entries()].map(async ([key, p]) => {
        const hit = knownMap.get(key) ?? (await fdaLabelMention(usName(names.get(p.x)!), usName(names.get(p.y)!)));
        if (hit && !knownMap.has(key)) {
          // Save FDA label findings so later checks are instant and give the same answer.
          await admin.from("drug_interactions").upsert(
            { ingredient_a: p.x, ingredient_b: p.y, ...hit },
            { onConflict: "ingredient_a,ingredient_b", ignoreDuplicates: true },
          );
        }
        return hit ? { p, hit } : null;
      }),
    );

    for (const r of results) {
      if (!r) continue;
      flags.push({
        type: "interaction",
        severity: r.hit.severity,
        medication_a_id: r.p.a.id,
        medication_b_id: r.p.b.id,
        ingredient_rxcui: r.p.x,
        source: r.hit.source,
        finding: r.hit.description,
        medicines: [r.p.a.label, r.p.b.label],
      });
    }
  }

  const order: Record<Severity, number> = { high: 0, moderate: 1, low: 2 };
  flags.sort((f, g) => order[f.severity] - order[g.severity]);
  return { flags, medicationsChecked: list.length };
}
