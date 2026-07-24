class Booking
  def initialize(show, date)
    @show = show
    @date = date
    @premium_delegate = nil
  end

  def be_premium(extras)
    @premium_delegate = PremiumBookingDelegate.new(self, extras)
  end

  def has_talkback?
    if @premium_delegate
      @premium_delegate.has_talkback?
    else
      @show.has_own_talkback? && !weekend?
    end
  end
end

class PremiumBookingDelegate
  def initialize(host_booking, extras)
    @host = host_booking
    @extras = extras
  end

  def has_talkback?
    @host.show.has_own_talkback?
  end
end
