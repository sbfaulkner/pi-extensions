def in_new_england?(customer)
  %w[MA CT ME VT NH RI].include?(customer.address.state)
end

# callers:
new_englanders = customers.select { |c| in_new_england?(c) }
