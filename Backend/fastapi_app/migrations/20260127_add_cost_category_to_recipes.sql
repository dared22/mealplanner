-- Add cost_category enum-like column to recipes

alter table if exists recipes
  add column if not exists cost_category varchar(32)
    check ((cost_category is null) or (cost_category in ('cheap', 'medium expensive')));

comment on column recipes.cost_category is 'Cost tier of the recipe: cheap | medium expensive';
