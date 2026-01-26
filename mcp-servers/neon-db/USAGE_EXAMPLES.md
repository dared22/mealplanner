# Neon DB MCP Server - Usage Examples

Once the MCP server is set up and Claude Code is restarted, you can use these tools in your conversations with Claude.

## Example Queries

### List all tables
```
Please list all tables in the database
```

Claude will use the `list_tables` tool to show you all tables, their columns, and structure.

### Get table schema
```
Describe the preferences table
```

Shows detailed schema including column types, constraints, primary keys, foreign keys, and indexes.

### Query data
```
Show me the last 5 meal plan preferences submitted
```

Claude will write and execute:
```sql
SELECT * FROM preferences ORDER BY submitted_at DESC LIMIT 5
```

### Complex queries
```
Find all users who have submitted preferences for vegetarian diets
```

Claude can join tables and filter:
```sql
SELECT u.email, p.dietary_restrictions, p.submitted_at
FROM users u
JOIN preferences p ON u.id = p.user_id
WHERE 'vegetarian' = ANY(p.dietary_restrictions)
ORDER BY p.submitted_at DESC
```

### Insert data
```
Add a test user with email test@example.com
```

Claude will execute:
```sql
INSERT INTO users (email, clerk_user_id)
VALUES ('test@example.com', 'test_clerk_id')
RETURNING *
```

### Update data
```
Update the budget_range for preference ID 5 to 'Medium'
```

### Analyze data
```
What's the distribution of nutrition goals in our preferences?
```

Claude can run aggregation queries:
```sql
SELECT nutrition_goal, COUNT(*) as count
FROM preferences
WHERE nutrition_goal IS NOT NULL
GROUP BY nutrition_goal
ORDER BY count DESC
```

### Get specific table data
```
Show me all recipes for breakfast
```

Uses the `get_table_data` tool with filtering:
```
table_name: "recipes"
where: "is_breakfast = true"
limit: 50
```

## Best Practices

1. **Read before write:** Always verify data with SELECT before UPDATE/DELETE
2. **Use transactions carefully:** The `execute` tool commits automatically
3. **Limit results:** Use LIMIT to avoid overwhelming output
4. **Be specific:** Provide table names and conditions clearly
5. **Verify changes:** Query data after updates to confirm changes

## Security

- The MCP server uses your database credentials from `.env`
- All queries are logged for audit purposes
- Write operations (`execute`) should be used carefully
- The server has full database access, so treat it like direct SQL access
