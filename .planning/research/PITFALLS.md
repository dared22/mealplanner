# Pitfalls Research: Personalized Recommendation Engine

**Domain:** Constraint-based hybrid recommendation system for meal planning
**Researched:** 2026-01-31
**Confidence:** MEDIUM-HIGH

This research identifies common mistakes when adding constraint-based recommendation systems to existing meal planning applications, with specific focus on hybrid approaches that combine OpenAI generation with constraint optimization.

---

## Critical Pitfalls

### Pitfall 1: Constraint Solver Timeout Without Graceful Degradation

**What goes wrong:**
The constraint solver exceeds the 10-second timeout threshold and either returns no result or shows a loading spinner indefinitely, leaving users with no meal plan at all. The system fails to fall back to the working OpenAI approach.

**Why it happens:**
- Over-constrained problems (e.g., user rated only 5 meals highly, all are breakfasts, but solver needs 21 meals/week)
- Combinatorial explosion when solving for 7 days × 3 meals with macro constraints + variety constraints + rating optimization simultaneously
- Recipe database size impacts search space - research shows constraint solvers degrade significantly with larger databases
- Time spent on the last few complete assignments makes up the majority of total search time, but brings minimal improvement

**Consequences:**
- User gets worse experience than before recommendation system was added
- Trust in personalization features erodes
- Users abandon the feature and revert to manual planning
- Support tickets spike with "meal plan won't load" complaints

**How to avoid:**
1. **Implement hard timeout at 8 seconds** (buffer before 10s SLA) with automatic fallback to OpenAI
2. **Progressive timeout strategy:**
   - 0-3s: Try optimal solution with all constraints
   - 3-6s: Relax variety constraints (allow some recent meal repetition)
   - 6-8s: Relax macro precision (±10% tolerance instead of ±5%)
   - 8s+: Fall back to OpenAI with user ratings as context
3. **Pre-solve feasibility check:** Before running expensive solver, verify:
   - Sufficient rated recipes in each meal category (≥3 per meal type)
   - Macro targets achievable with available recipes
   - No contradictory constraints (e.g., vegan + high protein + low calorie with limited recipe pool)
4. **Incremental solving:** Solve for 1 day first (fast), then expand to 7 days, aborting early if approaching timeout

**Warning signs:**
- Average solver execution time trending upward over 5 seconds
- Fallback to OpenAI rate exceeding 15% of requests
- User complaints about "loading forever"
- Timeout errors in application logs
- Solver spending >60% of time on last 10% of search

**Phase to address:**
Phase 2 (Constraint Solver Integration) - Build timeout handling and fallback from day one, not as an afterthought.

**Sources:**
- [Constraint solver meal planning performance issues](https://www.tautvidas.com/blog/2020/04/overcomplicating-meal-planning-with-z3-constraint-solver/)
- [Constraint satisfaction optimization timeout handling](https://arxiv.org/html/2510.04480v1)
- [Timeout core extraction method](https://patents.google.com/patent/US10832141/en)

---

### Pitfall 2: Infeasible Constraint Problems with No User Feedback

**What goes wrong:**
The constraint solver determines no feasible solution exists (e.g., "vegan + 200g protein/day + 1500 calories" with current recipe database), but provides no explanation to the user about WHY their plan failed or WHAT to change.

**Why it happens:**
- Solver returns "INFEASIBLE" status without identifying which constraints conflict
- System treats infeasibility as a generic error instead of a recoverable user input problem
- No Irreducible Inconsistent Subsystem (IIS) calculation to identify minimal conflicting constraint set
- Developers assume "just fall back to OpenAI" is sufficient, missing education opportunity

**Consequences:**
- User doesn't understand why personalization "doesn't work for them"
- Repeated failures train user to avoid the feature entirely
- No learning loop - user can't adjust behavior to get better results
- Hidden product value - user doesn't know that rating 3 more high-protein recipes would unlock solver

**How to avoid:**
1. **Compute conflict set** when solver returns INFEASIBLE:
   - Identify minimal subset of constraints causing infeasibility
   - Example: {vegan=true, protein>180g, calories<1600, rated_recipes_only=true}
2. **Provide actionable user feedback:**
   - "We couldn't find meals matching your preferences. Try one of these:"
   - "Rate 3+ high-protein vegan recipes" (addresses root cause)
   - "Increase calorie target to 1800+" (relaxation suggestion)
   - "Include all recipes (not just rated)" (temporary workaround)
3. **Constraint relaxation hierarchy** (try in order):
   - Relax variety constraints (allow 1 weekly repeat)
   - Expand macro tolerance (±10% → ±15%)
   - Include moderately-rated recipes (4-5 stars in addition to 5 stars)
   - Include unrated recipes similar to highly-rated ones
   - Fall back to OpenAI with explanation
4. **Proactive prevention:**
   - Warn during rating phase: "Rating more [breakfast/lunch/dinner] recipes improves plans"
   - Show progress bars: "8/15 recommended ratings for personalized plans"
   - Suggest recipe ratings that would unlock solver: "Rate these 3 to enable full personalization"

**Warning signs:**
- Infeasibility rate >5% of solver attempts
- Users with 10-30 ratings still hitting infeasibility
- No correlation between infeasibility and user adjustments (they're not learning)
- Support tickets asking "why doesn't personalization work?"

**Phase to address:**
Phase 2 (Constraint Solver Integration) - Implement IIS extraction and user feedback before launching solver.
Phase 3 (Rating Collection) - Add proactive guidance about rating diversity.

**Sources:**
- [Handling infeasibility with optimization models](https://medium.com/@AlainChabrier/handling-infeasibility-with-optimization-models-fd409f767dad)
- [Irreducible Inconsistent Subsystem (IIS)](https://support.gurobi.com/hc/en-us/articles/360029969391-How-do-I-determine-why-my-model-is-infeasible)
- [Constraint relaxation strategies](https://pubs.sciepub.com/jfnr/8/9/5/index.html)

---

### Pitfall 3: The Cold Start Cliff (Exactly 10 Ratings)

**What goes wrong:**
The system switches from OpenAI to solver at exactly 10 ratings, creating a discontinuity where user experience suddenly changes. Users with 10-12 ratings get worse plans than users with 8-9 ratings because the solver has insufficient data but is now responsible.

**Why it happens:**
- Hard cutoff (if ratings >= 10: use_solver else: use_openai) without hybrid transition
- Assumption that 10 ratings is "enough" for good recommendations, without empirical validation
- No quality comparison between OpenAI and solver output at the boundary
- Solver's first attempts are its worst (limited training data), but they replace OpenAI's best attempts

**Consequences:**
- Perverse incentive - users might avoid rating recipes to stay in "good" OpenAI mode
- Trust erosion at the critical moment when personalization should shine
- No graceful learning curve - solver needs 20-30 ratings to outperform OpenAI, but takes over at 10
- User confusion: "I gave ratings like you asked, and now my plans are WORSE?"

**How to avoid:**
1. **Hybrid transition zone (10-30 ratings):**
   - 10-15 ratings: Generate both OpenAI and solver plans, use solver only if quality score >0.7
   - 15-25 ratings: Try solver first with 5s timeout, fall back to OpenAI if timeout/infeasible
   - 25+ ratings: Solver primary, OpenAI fallback only
2. **Quality-based switching, not count-based:**
   - Metric: Predicted user satisfaction = (variety_score × 0.3) + (macro_accuracy × 0.3) + (rating_alignment × 0.4)
   - Use solver only when predicted_satisfaction(solver) > predicted_satisfaction(openai) + 0.1 (10% buffer)
3. **Solver quality threshold:**
   - Don't use solver if:
     - <5 rated recipes per meal type (breakfast/lunch/dinner)
     - Average rating variance too low (all 5s or all 3s = insufficient signal)
     - Recipe diversity too low (all rated recipes same cuisine)
4. **User transparency:**
   - "Your plan uses your ratings and preferences" (solver active)
   - "Your plan uses AI generation (rate more meals to unlock personalization)" (OpenAI active)
   - Never mention "solver" or "algorithm" - users don't care about implementation

**Warning signs:**
- User satisfaction drops after crossing 10-rating threshold
- Churn spike among users with 10-15 ratings vs. 5-10 ratings
- A/B test shows hard cutoff underperforms gradual transition
- Users deleting ratings to "fix" their plans

**Phase to address:**
Phase 4 (Hybrid Switching Logic) - This should be its own phase, not bundled with solver integration. Requires A/B testing and quality metrics.

**Sources:**
- [Cold start problem solutions](https://www.freecodecamp.org/news/cold-start-problem-in-recommender-systems/)
- [Hybrid recommendation system switching thresholds](https://www.mdpi.com/2313-433X/11/1/12)
- [User cold start systematic review](https://www.researchgate.net/publication/376140792_User_Cold_Start_Problem_in_Recommendation_Systems_A_Systematic_Review)

---

### Pitfall 4: Filter Bubble Creates Variety Fatigue

**What goes wrong:**
The constraint solver optimizes for user ratings so effectively that it recommends only the 10-15 highest-rated recipes on rotation, ignoring hundreds of other recipes. Users experience variety fatigue ("chicken and rice AGAIN?") despite having a diverse recipe database.

**Why it happens:**
- Objective function over-weights user ratings: `maximize(sum(meal.rating))` without diversity penalty
- No exploration vs. exploitation tradeoff - solver always exploits known preferences
- Recency constraints prevent repeats within 7 days, but user sees same meals every other week
- Human psychology: 5-star rating ≠ "I want this weekly forever"

**Consequences:**
- User engagement drops after 3-4 weeks when meal rotation becomes predictable
- Defeats the purpose of meal planning app - user could memorize their "rotation" without an app
- Recipe database becomes wasteful - 90% of recipes never recommended to heavy users
- Competitive disadvantage vs. OpenAI approach, which naturally varies suggestions

**How to avoid:**
1. **Diversity-aware objective function:**
   ```
   maximize(
     0.4 × rating_score +           # User preferences
     0.3 × variety_score +           # Recipe diversity
     0.2 × novelty_score +           # Introduce new recipes
     0.1 × nutrition_score           # Macro accuracy
   )
   ```
2. **Hard variety constraints:**
   - No recipe repeated more than 1×/week
   - No recipe repeated more than 1×/month (track in database)
   - Each week must include ≥2 recipes user has never tried before
   - Cuisine diversity: ≥3 different cuisines per week
3. **Exploration bonus:**
   - Unrated recipes predicted ≥4 stars: treat as 4.5 stars for solver (encourages trying them)
   - Decay previous ratings over time: 5-star rating from 3 months ago → 4.7 stars (novelty bonus)
   - "Wildcard meal" slot: 1 meal/week optimizes for novelty instead of rating
4. **User control:**
   - "Surprise me" toggle: increases novelty_score weight to 0.4
   - "Comfort food week" toggle: increases rating_score weight to 0.7, reduces novelty
   - Show variety metrics: "This week: 6 new recipes, 3 cuisines" (makes diversity visible)

**Warning signs:**
- Recipe recommendation entropy drops below 3.0 bits (concentrated on few recipes)
- Average user sees <30 unique recipes in first 3 months
- Churn spike at 4-6 week mark (variety fatigue sets in)
- User feedback: "Too repetitive" or "Same meals every week"
- Recipe database utilization <20% for users with 30+ ratings

**Phase to address:**
Phase 5 (Variety & Exploration) - Add after basic solver works, before public launch. Requires long-term user testing (6+ weeks).

**Sources:**
- [Filter bubbles in recommender systems](https://arxiv.org/pdf/2307.01221)
- [Avoiding meal repetition constraints](https://www.mdpi.com/2073-431X/13/1/1)
- [AI nutrition recommendation variety strategies](https://pmc.ncbi.nlm.nih.gov/articles/PMC12390980/)

---

### Pitfall 5: Data Sparsity - 10 Ratings Is Not Enough

**What goes wrong:**
The system assumes 10 ratings provide sufficient signal for quality recommendations, but in practice:
- 10 ratings across 200+ recipes = 5% data coverage
- If user rates 7 breakfasts, 2 lunches, 1 dinner: solver can't generate balanced weekly plans
- Rating bias (users rate tried-and-true favorites, not representative sample)
- Insufficient negative examples (users rate what they like, ignore what they dislike)

**Why it happens:**
- Arbitrary 10-rating threshold chosen without data analysis
- Underestimating the recipe space: 200 recipes × 3 meal types = 600 possible slots in context
- Collaborative filtering typically needs 20-50 ratings per user for quality recommendations
- Content-based filtering (your approach) needs representative coverage, not just count

**Consequences:**
- Solver recommendations heavily biased toward the few rated categories
- Users with imbalanced ratings (e.g., 10 breakfast ratings) get poor lunch/dinner recommendations
- Model can't distinguish "I haven't rated this" (unknown) from "I don't like this" (negative signal)
- Quality doesn't improve as expected when crossing 10-rating threshold

**How to avoid:**
1. **Minimum ratings per meal type:**
   - Require ≥3 breakfast + ≥3 lunch + ≥3 dinner ratings before solver activates (9 total minimum)
   - Or: Use hybrid mode if distribution is imbalanced (e.g., 8 breakfasts, 1 lunch, 1 dinner)
2. **Guided rating collection:**
   - "Rate 3 breakfasts, 3 lunches, 3 dinners to unlock personalized plans"
   - Progress indicator: [Breakfast: 2/3] [Lunch: 1/3] [Dinner: 0/3]
   - Suggest representative recipes to rate: variety across cuisines, protein sources, complexity
3. **Implicit rating collection:**
   - When user generates OpenAI plan: "Which of these meals would you make again?" → collect ratings
   - Track which recipes user views details for (implicit positive signal)
   - Track which recipes user skips/regenerates (implicit negative signal)
4. **Negative ratings matter:**
   - Encourage rating low-appeal recipes: "This helps us avoid suggesting similar meals"
   - Prompt after plan generation: "Which meals don't appeal to you?" (collect 1-2 star ratings)
   - Frame negative ratings positively: "Teach us what NOT to suggest"
5. **Increase threshold with transparency:**
   - Raise to 15 ratings (5 per meal type) if data analysis shows 10 is insufficient
   - Or keep 10 but use hybrid mode longer (until 25+ ratings)
   - Monitor precision@10 metric: are top-10 solver recommendations better than OpenAI?

**Warning signs:**
- Solver recommendations not improving between 10-20 ratings
- Users with 10+ ratings still seeing mismatched meals (breakfast recipes for dinner)
- Low rating diversity: 80%+ of ratings are 4-5 stars (insufficient negative signal)
- Meal type imbalance: >60% of ratings in single category
- User feedback: "Personalization doesn't understand my preferences"

**Phase to address:**
Phase 3 (Rating Collection) - Design rating UX to ensure balanced, representative coverage before solver activates.
Phase 4 (Hybrid Switching Logic) - Monitor data quality, not just rating count.

**Sources:**
- [Data sparsity in meal planning recommendations](https://www.researchgate.net/publication/373909896_Meal_Plan_Monitoring_and_Recommendation_System)
- [Minimum ratings for recommendation quality](https://github.com/Devinterview-io/recommendation-systems-interview-questions)
- [Rating normalization and sparsity](https://pmc.ncbi.nlm.nih.gov/articles/PMC12390980/)

---

### Pitfall 6: The "Magic" Expectation Gap

**What goes wrong:**
Users expect personalized recommendations to feel magical ("it just knows what I want"), but constraint solver output feels algorithmic and predictable. Users perceive the system as "doing math" rather than "understanding me," even if recommendations are technically better.

**Why it happens:**
- Constraint solvers produce deterministic, optimized results that lack human-like serendipity
- OpenAI output includes variety, unexpected combinations, and "creative" suggestions
- Users notice patterns: "It always suggests salmon on Monday" or "High-protein = always chicken"
- Transparency backlog: showing "optimized for your ratings" makes algorithm visible, reducing magic
- Industry context: ChatGPT has trained users to expect AI = conversational, adaptive, surprising

**Consequences:**
- Users prefer OpenAI mode even when solver is objectively better
- Net Promoter Score drops despite improved macro accuracy and rating alignment
- Feature perceived as "robotic" or "mechanical" vs. "intelligent" or "personalized"
- Competitive risk: competitors using pure LLM approaches feel more "AI-powered"
- User churn: "I switched to [competitor] - their AI is smarter"

**How to avoid:**
1. **Hybrid presentation (even when using solver):**
   - Generate solver plan (optimal)
   - Use OpenAI to "explain" 2-3 meal choices: "We included this spicy Thai curry because you loved the pad thai"
   - Add LLM-generated meal descriptions: "A protein-packed lunch to fuel your afternoon"
   - Present plan as "AI-generated with your preferences" (hide solver entirely from UX)
2. **Controlled randomness:**
   - Add ±5% noise to constraint weights so same inputs don't always produce same output
   - Solver still optimizes, but not identically each time
   - "Surprise me" generates 3 solver plans with different variety/novelty weights, picks highest-scoring
3. **Narrative framing:**
   - Never say "algorithm" or "optimization" or "constraint solver"
   - Do say "AI learns your preferences" or "personalized by AI"
   - Frame as adaptive: "Your AI meal planner gets smarter as you rate recipes"
   - Use ChatGPT-style language even if backend is solver
4. **Serendipity injection:**
   - 1-2 "wildcard" meals per week that aren't optimized, just interesting/seasonal/trending
   - "Chef's pick" slot: high-rated recipe user hasn't tried yet
   - Explain wildcards: "We thought you'd enjoy trying something new"
5. **Personification:**
   - "Your meal plan is ready" not "Optimization complete"
   - "We noticed you love Asian cuisine, so we added more this week"
   - Use first person: "I found recipes that match your goals"

**Warning signs:**
- Users describe feature as "robotic" or "formulaic" in feedback
- Net Promoter Score lower for solver mode vs. OpenAI mode
- Users switching back to manual planning or competitors
- Low engagement with solver-generated plans (not clicking through to recipes)
- A/B test shows solver technically better but lower user satisfaction

**Phase to address:**
Phase 6 (Polish & UX) - After solver works technically, invest in making it feel magical.
Phase 4 (Hybrid Switching Logic) - Consider using OpenAI to augment solver output from the start.

**Sources:**
- [User expectations for AI personalization](https://medium.com/beyond-the-build/navigating-recommender-systems-unveiling-insights-and-evolution-a42932597957)
- [Algorithmic transparency vs. user trust](https://www.sciencedirect.com/science/article/pii/S0001691825006961)
- [The "magic barrier" in recommendation systems](https://couture.ai/blog/personalized-recommendations/)
- [Facebook Reels adapting based on user feedback](https://engineering.fb.com/2026/01/14/ml-applications/adapting-the-facebook-reels-recsys-ai-model-based-on-user-feedback/)

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| No timeout handling - "solver is fast enough" | Ship faster, simpler code | Users experience freezes, no fallback when solver fails | Never - timeout handling is critical for production |
| Hard 10-rating cutoff instead of hybrid transition | Simple if/else logic, clear boundary | Poor UX at boundary, user confusion | Only for MVP/prototype |
| Maximize ratings only (no diversity penalty) | Simpler objective function, faster solving | Filter bubble, variety fatigue after 3-4 weeks | Never - diversity is core value prop |
| No infeasibility feedback - just fall back silently | Avoids complex IIS computation, faster fallback | Users never learn how to get better results | Only if <2% infeasibility rate |
| Skip negative ratings (only collect positive) | Less friction in rating UX | Solver can't learn dislikes, recommends unwanted meals | Acceptable if using implicit negative signals |
| No recency tracking (allow any non-weekly repeats) | Simpler state management, no database history | Users see same 15 meals on rotation forever | Acceptable for first 3 months post-launch |
| Solver-only mode (no hybrid with OpenAI) | Cleaner architecture, one code path | Fails hard when solver times out or hits edge cases | Only if solver proven 99.9% reliable |
| Use recipe count not meal type distribution | Simpler validation logic | Users with 10 breakfast ratings get poor dinner plans | Never - meal type balance is critical |
| No quality comparison (solver always wins if ≥10 ratings) | Deterministic switching, no complexity | Users get worse plans after crossing threshold | Only for MVP before quality metrics exist |

---

## Integration Gotchas

Common mistakes when integrating constraint solver with existing OpenAI-based system.

| Integration Point | Common Mistake | Correct Approach |
|-------------------|----------------|------------------|
| Fallback to OpenAI | Losing user rating context when falling back - solver fails, OpenAI generates generic plan ignoring ratings | Pass user ratings to OpenAI as context: "User loves: [5-star recipes]. User dislikes: [1-2 star recipes]" |
| Nutritional constraints | Different macro calculation between solver and OpenAI - user notices inconsistency ("why is protein different?") | Use same nutrition calculator for both paths, validate outputs match user targets ±5% |
| Recipe database | Solver uses Parquet file, OpenAI uses recipe names only - can hallucinate recipes not in database | Provide OpenAI with full recipe database schema, validate all suggestions exist in database |
| Plan storage | Storing only final plan, not which system generated it - can't debug or analyze solver vs. OpenAI quality | Store `generation_method: "solver"` or `"openai"` with every plan for analytics |
| Background tasks | Solver runs synchronously, blocking user - loses existing async pattern from OpenAI implementation | Run solver in background task identical to OpenAI, same polling mechanism |
| Error handling | Generic "generation failed" for both solver timeout and OpenAI API error - different root causes need different handling | Specific error types: SolverTimeoutError, SolverInfeasibleError, OpenAIError with distinct user messages |
| User preferences | Solver ignores `raw_data` fields that OpenAI uses (cooking time, cuisine preferences) - inconsistent personalization | Parse all Preference model fields into constraints: cooking_time → time_limit constraint, preferred_cuisines → cuisine_bonus |
| Translation | Translating solver output differently than OpenAI output - inconsistent UX across languages | Use same `recipe_translator.py` for both solver and OpenAI generated plans |
| Caching | No caching because solver is "fast" - but 5-8 second generation still poor UX vs. instant cache hit | Cache solver results by (user_id, ratings_hash, date) - same user same day should be instant |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading all recipes into solver for every request | Works fine with 200 recipes, but query time scales O(n²) with recipe count | Pre-filter recipes before solver: only recipes matching dietary restrictions, meal type, available ingredients | >500 recipes or >10 concurrent users |
| Synchronous solver execution (no timeout/async) | User waits 8 seconds, acceptable during testing | Run solver in background task with 8s timeout, return cached/previous plan if timeout | Production traffic >50 requests/hour |
| No solver result caching | Regenerating identical plans for same user multiple times/day wastes compute | Cache by (user_id, ratings_hash, preferences_hash, target_date) for 24h | >100 active users |
| Solving 7 days simultaneously | 7-day solve times out, but problem seems inherently complex | Solve 1-day first, then expand to 3-day, then 7-day - abort early if timeout approaching | Macro constraints tighter than ±10% |
| No database indexes on ratings | Full table scan on `Preference.user_id` for every solver call | Add indexes: `CREATE INDEX idx_user_ratings ON preferences(user_id, created_at)` | >1000 preferences in database |
| Recomputing macro targets every request | Calculating TDEE, macro split, meal distribution for every plan generation | Cache user macro targets, recalculate only when user profile changes | >500 users or >1000 requests/day |
| No query timeout on recipe database | Parquet file load blocks for 2-3 seconds if file locked or disk slow | Set 2s timeout on recipe queries, fall back to cached recipe list | Concurrent traffic >5 requests/second |
| Unbounded variety constraints | "No recipe repeated in last 90 days" requires loading 90+ previous plans | Limit to "last 4 weeks" or "last 20 plans" to bound database query | Users with >50 historical plans |

---

## UX Pitfalls

Common user experience mistakes in recommendation systems.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No explanation for why meals were chosen | User sees unfamiliar recipe, doesn't understand why it's recommended, loses trust | "We included this because you rated [similar recipe] 5 stars" or "High in protein to match your goals" |
| Forcing users to rate before seeing value | New user must rate 10 recipes before any personalization - high friction, many abandon | Use OpenAI for first 2-3 plans, then prompt rating: "Rate these meals to improve future plans" |
| All-or-nothing personalization | Either fully personalized (solver) or generic (OpenAI) - no middle ground | Hybrid mode: "This week mixes your favorites with new suggestions" |
| No control over variety vs. familiarity | Some users want adventure, others want comfort food - same algorithm for all | "Surprise me" vs. "Stick to favorites" toggle - adjusts novelty weight in solver |
| Hidden rating distribution | User doesn't know rating 3 more breakfast recipes would unlock better plans | Progress indicator: "Rate 2 more breakfast recipes for better breakfast suggestions" |
| No feedback loop on recommendations | User gets unwanted meal, can't signal dislike without rating recipe beforehand | "Not interested" button on generated plans - collect implicit negative ratings |
| Regeneration creates identical plan | User clicks "regenerate" but solver produces same output (deterministic) | Add controlled randomness or explain: "Your plan is optimized - change preferences to see different meals" |
| No transparency on why solver vs. OpenAI | User doesn't know which system generated their plan or why | Subtle indicator: "Personalized with your ratings" (solver) vs. "AI-generated" (OpenAI) |
| Unexpected meal at unexpected time | Solver suggests breakfast recipe for dinner because constraints don't encode meal timing | Enforce meal type constraints: breakfast recipes only for breakfast slots, never dinner |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Constraint solver integration:** Often missing timeout handling - verify 10s timeout exists with graceful fallback
- [ ] **Infeasibility handling:** Often missing user feedback - verify IIS extraction and actionable error messages
- [ ] **Hybrid switching logic:** Often missing quality comparison - verify solver output is actually better than OpenAI before switching
- [ ] **Variety constraints:** Often missing recency tracking - verify database stores/queries previous 4 weeks of meals
- [ ] **Rating collection:** Often missing meal type distribution validation - verify ≥3 ratings per breakfast/lunch/dinner
- [ ] **Fallback to OpenAI:** Often missing rating context - verify OpenAI receives user ratings even in fallback mode
- [ ] **Macro constraints:** Often missing tolerance ranges - verify ±10% tolerance, not exact equality (infeasible)
- [ ] **Negative ratings:** Often missing collection UX - verify users can rate recipes 1-5 stars, not just thumbs up
- [ ] **Cache invalidation:** Often missing ratings change detection - verify cache invalidates when user adds new ratings
- [ ] **Performance monitoring:** Often missing solver execution time metrics - verify logging/metrics for timeout detection
- [ ] **Recipe filtering:** Often missing dietary restriction enforcement - verify solver only considers valid recipes
- [ ] **Explanation generation:** Often missing for solver output - verify users understand why meals were chosen

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Solver timeouts >20% of requests | MEDIUM | 1. Reduce timeout to 5s, 2. Relax constraints (increase macro tolerance to ±15%), 3. Pre-filter recipes more aggressively, 4. Consider faster solver library (OR-Tools → PuLP → Gurobi) |
| Filter bubble - users complaining about repetition | LOW | 1. Add variety bonus retroactively, 2. Increase novelty weight in objective function, 3. Add "Surprise me this week" one-click option to inject novelty |
| Poor plans at 10-15 ratings | LOW | 1. Increase threshold to 15 ratings, 2. Add hybrid mode for 10-20 ratings, 3. Improve rating collection UX to get to 20 faster |
| Infeasibility rate >10% | MEDIUM | 1. Add constraint relaxation hierarchy, 2. Implement IIS extraction and user feedback, 3. Analyze common failure patterns and adjust defaults |
| Users prefer OpenAI over solver | HIGH | 1. Use OpenAI to augment solver (explanations, descriptions), 2. Add randomness to solver, 3. Rebrand as "AI-powered", 4. Consider keeping OpenAI as default with solver as opt-in |
| Data sparsity - imbalanced ratings | LOW | 1. Guided rating prompts ("Rate 2 more lunches"), 2. Collect implicit ratings from plan interactions, 3. Stay in hybrid mode longer |
| Performance degradation with scale | MEDIUM-HIGH | 1. Add caching layer (Redis), 2. Pre-compute user macro targets, 3. Add database indexes, 4. Implement request throttling/queuing |
| User expectations not met ("not magical") | MEDIUM | 1. Invest in copywriting/presentation, 2. Add LLM-generated explanations, 3. Personify the system, 4. User test with "magic" as success metric |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Solver timeout without fallback | Phase 2: Solver Integration | Load test with over-constrained problems, verify <5% timeout + 100% fallback success |
| Infeasible constraints with no feedback | Phase 2: Solver Integration | Create impossible constraint combination, verify user sees actionable error message |
| Cold start cliff at 10 ratings | Phase 4: Hybrid Switching Logic | A/B test hard cutoff vs. gradual transition, measure satisfaction at 10-15 ratings |
| Filter bubble variety fatigue | Phase 5: Variety & Exploration | Track recipe entropy and unique recipes/month, verify >40 unique recipes in 3 months |
| Data sparsity (10 ratings insufficient) | Phase 3: Rating Collection | Measure recommendation quality (precision@10) at 10, 15, 20, 25 ratings |
| "Magic" expectation gap | Phase 6: Polish & UX | User testing with "feels intelligent" as success metric, NPS comparison |
| Performance at scale | Phase 7: Production Hardening | Load test with 100 concurrent users, verify p95 latency <10s, cache hit rate >60% |
| Losing rating context in fallback | Phase 2: Solver Integration | Code review: verify OpenAI fallback includes rating context |
| No variety tracking across weeks | Phase 5: Variety & Exploration | Database schema review: verify meal history table exists and is queried |
| Poor UX at solver/OpenAI boundary | Phase 4: Hybrid Switching Logic | User testing at 8-12 rating range, verify seamless experience |

---

## Phase-Specific Research Flags

Phases that will likely need deeper research during execution.

| Phase | Research Needed | Why |
|-------|----------------|-----|
| Phase 2: Solver Integration | Solver library comparison (OR-Tools, PuLP, Gurobi, CVXPY) | Performance characteristics vary 10-100× between libraries for constraint optimization |
| Phase 4: Hybrid Switching Logic | Quality metrics for meal plans | No established metric for "meal plan quality" - need to define and validate |
| Phase 5: Variety & Exploration | Optimal diversity penalties | Trade-off between optimization (user ratings) and exploration (variety) is empirical, needs testing |
| Phase 6: Polish & UX | LLM prompting for explanations | Generating natural-sounding explanations for solver choices requires prompt engineering |
| Phase 7: Production Hardening | Caching strategy for personalized content | Standard HTTP caching doesn't work - need personalized cache with ratings-aware invalidation |

---

## Sources

### Constraint Solver Performance
- [Overcomplicating meal planning with Z3 Constraint Solver](https://www.tautvidas.com/blog/2020/04/overcomplicating-meal-planning-with-z3-constraint-solver/)
- [Constraint satisfaction optimization timeout handling (FourierCSP)](https://arxiv.org/html/2510.04480v1)
- [Timeout core extraction method (Patent)](https://patents.google.com/patent/US10832141/en)

### Cold Start Problem
- [Cold start problem in recommendation systems (freeCodeCamp)](https://www.freecodecamp.org/news/cold-start-problem-in-recommender-systems/)
- [User cold start systematic review](https://www.researchgate.net/publication/376140792_User_Cold_Start_Problem_in_Recommendation_Systems_A_Systematic_Review)
- [Hybrid recommendation system quality review](https://www.mdpi.com/2313-433X/11/1/12)

### Infeasibility & Constraint Relaxation
- [Handling infeasibility with optimization models](https://medium.com/@AlainChabrier/handling-infeasibility-with-optimization-models-fd409f767dad)
- [How to determine why model is infeasible (Gurobi)](https://support.gurobi.com/hc/en-us/articles/360029969391-How-do-I-determine-why-my-model-is-infeasible)
- [Family meal planning constraint relaxation](https://pubs.sciepub.com/jfnr/8/9/5/index.html)

### Filter Bubble & Variety
- [Filter bubbles in recommender systems - systematic review](https://arxiv.org/pdf/2307.01221)
- [Healthy personalized recipe recommendations for weekly meal planning](https://www.mdpi.com/2073-431X/13/1/1)
- [AI-based nutrition recommendation with variety constraints](https://pmc.ncbi.nlm.nih.gov/articles/PMC12390980/)

### Data Sparsity & Rating Requirements
- [Meal plan monitoring and recommendation system](https://www.researchgate.net/publication/373909896_Meal_Plan_Monitoring_and_Recommendation_System)
- [Recommendation systems interview questions (GitHub)](https://github.com/Devinterview-io/recommendation-systems-interview-questions)

### User Expectations & "Magic"
- [Navigating recommender systems - insights and evolution](https://medium.com/beyond-the-build/navigating-recommender-systems-unveiling-insights-and-evolution-a42932597957)
- [Algorithm awareness and technology acceptance](https://www.sciencedirect.com/science/article/pii/S0001691825006961)
- [Facebook Reels adapting based on user feedback](https://engineering.fb.com/2026/01/14/ml-applications/adapting-the-facebook-reels-recsys-ai-model-based-on-user-feedback/)
- [Personalized recommendations guide](https://couture.ai/blog/personalized-recommendations/)

### Hybrid Systems & Switching
- [Hybrid recommendation system optimization (OHWSF model)](https://www.mdpi.com/2313-433X/11/1/12)
- [7 types of hybrid recommendation systems](https://medium.com/analytics-vidhya/7-types-of-hybrid-recommendation-system-3e4f78266ad8)

---

*Pitfalls research for: Constraint-based hybrid recommendation system for meal planning*
*Researched: 2026-01-31*
