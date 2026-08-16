insert into public.hotels (id, name, location, owner_name, mobile_number, email, owner_pin, budget_split, currency)
values (
  '11111111-1111-1111-1111-111111111111',
  'Sample Indian Bistro',
  'Chennai',
  'Demo Owner',
  '+91 98765 43210',
  'owner@example.com',
  '1234',
  '{"starters": 0.35, "mains": 0.65}',
  'INR'
)
on conflict (id) do update set
  name = excluded.name,
  location = excluded.location,
  owner_name = excluded.owner_name,
  mobile_number = excluded.mobile_number,
  email = excluded.email,
  owner_pin = excluded.owner_pin,
  budget_split = excluded.budget_split,
  currency = excluded.currency;

insert into public.menu_items (id, hotel_id, name, category, price, veg_flag, spice_level, serves_count, must_try, is_available)
values
  ('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111111', 'Paneer Tikka', 'starter', 320, true, 'medium', 2, true, true),
  ('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111111', 'Hara Bhara Kebab', 'starter', 260, true, 'mild', 2, false, true),
  ('33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111111', 'Tandoori Mushroom', 'starter', 290, true, 'medium', 2, false, true),
  ('33333333-3333-3333-3333-333333333304', '11111111-1111-1111-1111-111111111111', 'Chicken Malai Tikka', 'starter', 380, false, 'mild', 2, true, true),
  ('33333333-3333-3333-3333-333333333305', '11111111-1111-1111-1111-111111111111', 'Chicken 65', 'starter', 340, false, 'hot', 2, false, true),
  ('33333333-3333-3333-3333-333333333306', '11111111-1111-1111-1111-111111111111', 'Amritsari Fish Fry', 'starter', 420, false, 'medium', 2, false, true),
  ('33333333-3333-3333-3333-333333333307', '11111111-1111-1111-1111-111111111111', 'Dal Makhani', 'main', 310, true, 'mild', 2, true, true),
  ('33333333-3333-3333-3333-333333333308', '11111111-1111-1111-1111-111111111111', 'Paneer Butter Masala', 'main', 360, true, 'mild', 2, false, true),
  ('33333333-3333-3333-3333-333333333309', '11111111-1111-1111-1111-111111111111', 'Veg Kolhapuri', 'main', 330, true, 'hot', 2, false, true),
  ('33333333-3333-3333-3333-333333333310', '11111111-1111-1111-1111-111111111111', 'Butter Chicken', 'main', 450, false, 'medium', 2, true, true),
  ('33333333-3333-3333-3333-333333333311', '11111111-1111-1111-1111-111111111111', 'Mutton Rogan Josh', 'main', 560, false, 'medium', 2, false, true),
  ('33333333-3333-3333-3333-333333333312', '11111111-1111-1111-1111-111111111111', 'Hyderabadi Chicken Biryani', 'rice', 420, false, 'medium', 2, false, true),
  ('33333333-3333-3333-3333-333333333313', '11111111-1111-1111-1111-111111111111', 'Vegetable Dum Biryani', 'rice', 340, true, 'medium', 2, false, true),
  ('33333333-3333-3333-3333-333333333314', '11111111-1111-1111-1111-111111111111', 'Garlic Naan Basket', 'bread', 180, true, 'mild', 3, false, true),
  ('33333333-3333-3333-3333-333333333315', '11111111-1111-1111-1111-111111111111', 'Jeera Rice', 'rice', 190, true, 'mild', 2, false, true)
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  price = excluded.price,
  veg_flag = excluded.veg_flag,
  spice_level = excluded.spice_level,
  serves_count = excluded.serves_count,
  must_try = excluded.must_try,
  is_available = excluded.is_available;
