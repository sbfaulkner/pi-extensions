def print_owing(invoice)
  outstanding = 0

  puts "***********************"
  puts "**** Customer Owes ****"
  puts "***********************"

  invoice[:orders].each { |o| outstanding += o[:amount] }

  puts "name: #{invoice[:customer]}"
  puts "amount: #{outstanding}"
end
