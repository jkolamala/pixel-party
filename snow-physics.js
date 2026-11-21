/* Original downhill simulation. World units are metres, time is seconds. */
class SnowRun {
  constructor(random = Math.random) { this.random = random; this.reset(); }
  reset() {
    this.x = 0; this.z = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.failure = null; this.speed = 18; this.gifts = 0; this.alive = true; this.reason = '';
    this.objects = []; this.gaps = []; this.nextRow = 46; this.row = 0;
    this.generate();
  }
  jump() { if (this.alive && this.y === 0) this.vy = 8.8; }
  generate() {
    while (this.nextRow < this.z + 190) {
      const z = this.nextRow, r = this.random;
      if (this.row > 0 && this.row % 11 === 0) {
        this.gaps.push({ start: z, end: z + 5.5 });
        this.objects.push({ type: 'gift', x: 0, z: z + 2.5, height: 1.1, radius: .38 });
        this.nextRow += 29;
      } else {
        const safe = Math.floor(r() * 6), count = this.row < 4 ? 1 : 2 + (r() > .65 ? 1 : 0);
        const slots = [0,1,2,3,4,5].filter(n => n !== safe);
        for (let i = 0; i < count; i++) {
          const lane = slots.splice(Math.floor(r() * slots.length), 1)[0];
          const pick = r(), type = pick < .4 ? 'tree' : pick < .65 ? 'rock' : pick < .85 ? 'log' : 'snowman';
          const sizes = { tree: [.85, 4.8], rock: [.9, .85], log: [1.2, .55], snowman: [.75, 1.9] };
          this.objects.push({ type, x: (lane - 2.5) * 3, z, radius: sizes[type][0], height: sizes[type][1] });
        }
        this.objects.push({ type: 'gift', x: (safe - 2.5) * 3, z: z + 3, radius: .38, height: .4 });
        this.nextRow += 21 + r() * 10;
      }
      this.row++;
    }
  }
  fail(reason, type = 'impact', gap = null) { if(!this.alive)return; this.alive = false; this.reason = reason; this.failure = {type,gap}; }
  step(dt, steering) {
    if (!this.alive) return;
    const previousZ = this.z;
    // Gradually approach 38 m/s; no abrupt difficulty steps.
    this.speed = 18 + 20 * (1 - Math.exp(-this.z / 1400));
    this.vx += (steering * 10 - this.vx) * (1 - Math.exp(-dt * (this.y > 0 ? 5 : 11)));
    this.x += this.vx * dt; this.z += this.speed * dt;
    if (this.vy !== 0 || this.y > 0) {
      this.vy -= 21 * dt; this.y = Math.max(0, this.y + this.vy * dt);
      if (this.y === 0) this.vy = 0;
    }
    if (Math.abs(this.x) > 9.5) this.fail('You left the slope');
    for (const obj of this.objects) {
      if (obj.collected || obj.z + obj.radius < previousZ - .55 || obj.z - obj.radius > this.z + .55) continue;
      if (Math.abs(obj.x - this.x) > obj.radius + .45) continue;
      if (obj.type === 'gift') {
        if (Math.abs(this.y + .35 - obj.height) < 1.1) { obj.collected = true; this.gifts++; }
      } else if (this.y < obj.height) this.fail('You hit a ' + obj.type);
    }
    const gap = this.gaps.find(g => this.z + .5 > g.start && this.z - .5 < g.end);
    if (gap && this.y < .2) this.fail('Jump over the ravine', 'ravine', gap);
    this.objects = this.objects.filter(o => !o.collected && o.z > this.z - 12);
    this.gaps = this.gaps.filter(g => g.end > this.z - 15);
    this.generate();
  }
}
