def print_owing(invoice)
  print_banner
  outstanding = calculate_outstanding(invoice)
  print_details(invoice, outstanding)
end

def print_banner
  puts "***********************"
  puts "**** Customer Owes ****"
  puts "***********************"
end

def calculate_outstanding(invoice)
  invoice[:orders].sum { |o| o[:amount] }
end

def print_details(invoice, outstanding)
  puts "name: #{invoice[:customer]}"
  puts "amount: #{outstanding}"
end
