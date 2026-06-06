export interface ProfileInput {
  name?: string;
  age: number;
  sex: 'male' | 'female';
  weight_kg: number;
  height_cm: number;
  activity_level: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  goal?: 'lose' | 'maintain' | 'gain';
}

export interface ProfileResult extends ProfileInput {
  userId: string;
  bmr: number;
  tdee: number;
}

const ACTIVITY_MULTIPLIERS: Record<ProfileInput['activity_level'], number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function computeBmr(
  input: Pick<ProfileInput, 'age' | 'sex' | 'weight_kg' | 'height_cm'>
): number {
  const base = 10 * input.weight_kg + 6.25 * input.height_cm - 5 * input.age;
  return Math.round(input.sex === 'male' ? base + 5 : base - 161);
}

export function computeTdee(bmr: number, activityLevel: ProfileInput['activity_level']): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
}

export async function getProfile(_userId: string): Promise<ProfileResult | null> {
  // Stub — no DB layer yet
  return null;
}

export async function upsertProfile(userId: string, input: ProfileInput): Promise<ProfileResult> {
  // Stub — no DB layer yet; compute and return without persisting
  const bmr = computeBmr(input);
  const tdee = computeTdee(bmr, input.activity_level);
  return { ...input, userId, bmr, tdee };
}
