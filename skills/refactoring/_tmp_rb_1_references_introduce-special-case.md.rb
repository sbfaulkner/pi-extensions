name = customer == "unknown" ? "occupant" : customer.name
plan = customer == "unknown" ? Registry.billing_plans[:basic] : customer.billing_plan
