class Organization
  def initialize(data)
    @name = data[:name]
    @country = data[:country]
  end

  attr_accessor :name, :country
end

organization = Organization.new(name: "Acme Gooseberries", country: "GB")
organization.name
