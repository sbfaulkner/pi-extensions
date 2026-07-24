def resource_for(name)
  return ResourcePool.create(name) if @available.empty?

  @available.pop
end
