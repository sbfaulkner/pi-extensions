class Scroll
  def initialize(id, title, tags, date_last_cleaned)
    @category_item = CategoryItem.new(id, title, tags)
    @last_cleaned = date_last_cleaned
  end

  def title
    @category_item.title
  end

  def has_tag?(tag)
    @category_item.has_tag?(tag)
  end
end
