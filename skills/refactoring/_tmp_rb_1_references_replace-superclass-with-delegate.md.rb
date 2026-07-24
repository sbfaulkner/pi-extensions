class Scroll < CategoryItem
  def initialize(id, title, tags, date_last_cleaned)
    super(id, title, tags)
    @last_cleaned = date_last_cleaned
  end
end
