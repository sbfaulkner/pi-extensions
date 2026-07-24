def state_in_new_england?(state_code)
  %w[MA CT ME VT NH RI].include?(state_code)
end

# callers:
new_englanders = customers.select { |c| state_in_new_england?(c.address.state) }
