def resource_for(name)
  begin
    @available.pop
  rescue NoMethodError
    ResourcePool.create(name)
  end
end
