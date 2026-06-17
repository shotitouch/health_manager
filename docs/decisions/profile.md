# Profile Decisions

## BMR uses Mifflin-St Jeor formula

`BMR = 10×weight_kg + 6.25×height_cm − 5×age + 5 (male) / −161 (female)`

**Why:** Mifflin-St Jeor is the most widely validated formula for resting metabolic rate in modern clinical literature; more accurate than Harris-Benedict for typical adults.

---

## TDEE = BMR × activity multiplier (5 levels)

Multipliers: sedentary 1.2, light 1.375, moderate 1.55, active 1.725, very_active 1.9.

**Why:** standard PAL (Physical Activity Level) multipliers from exercise science; five levels covers the practical range without overwhelming users.

---

## BMR/TDEE computed server-side, not client-side

**Why:** keeps the calculation authoritative and consistent; future features (dashboard, summary) can call the profile service to get TDEE without re-implementing the formula.
