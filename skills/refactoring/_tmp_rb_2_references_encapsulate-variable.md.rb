$default_owner_data = { first_name: "Martin", last_name: "Fowler" }

def default_owner
  $default_owner_data.dup # return a copy to protect the shared value
end

def default_owner=(arg)
  $default_owner_data = arg
end

# usage
spaceship[:owner] = default_owner
