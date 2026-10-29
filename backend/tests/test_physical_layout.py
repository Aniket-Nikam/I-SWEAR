import math
import pytest
from app.maps import map_data
from app.navigation import walking_path
from app.world import blocked, integrate
from app.investigation import CASE_BINDINGS


def test_expansion_preserves_existing_badge_access_and_has_independent_records():
    # The original threshold record belongs to badge 1, including saved cases.
    assert list(CASE_BINDINGS).index('hall_footprints') % 4 == 0
    for map_id,count in (('campus',3),('observatory',2),('ferry',2)):
        world=map_data(map_id)
        new_records=[item for item in world['objects'] if '_expansion_' in item['id']]
        assert len(new_records)==count
        assert all(item['id'] in CASE_BINDINGS for item in new_records)


def test_visible_benches_stop_the_authoritative_witness_from_both_sides():
    world = map_data('campus')
    benches = [f for f in world['furniture'] if f['kind']=='bench']
    assert len(benches)>=4
    for bench in benches:
        x, cy = bench['x'], bench['y']-2
        assert [x, cy, bench['w'], bench['d']] in world['obstacles']
        for sign in (-1,1):
            y=cy+sign*(bench['d']/2+50)
            if blocked(x,y,world['collision']):
                continue
            vx=vy=0
            for _ in range(120):
                x,y,vx,vy=integrate(x,y,vx,vy,0,-sign,.05,world)
                assert not blocked(x,y,world['collision'])
                assert (y-cy)*sign>=bench['d']/2+12


@pytest.mark.parametrize('map_id',('campus','observatory','ferry'))
def test_all_evidence_can_be_reached_without_crossing_furniture(map_id):
    world=map_data(map_id)
    for obj in world['objects']:
        route=walking_path(map_id,world['spawns'][0],(obj['x'],obj['y']))
        assert math.dist(route[-1],(obj['x'],obj['y']))<96
        for start,end in zip(route,route[1:]):
            steps=max(1,math.ceil(math.dist(start,end)/4))
            for i in range(steps+1):
                x=start[0]+(end[0]-start[0])*i/steps
                y=start[1]+(end[1]-start[1])*i/steps
                assert not blocked(x,y,world['collision']),obj['id']


@pytest.mark.parametrize('map_id',('campus','observatory','ferry'))
def test_door_thresholds_are_real_openings_with_furniture_clearance(map_id):
    world=map_data(map_id)
    assert len(world['doors'])>=15
    for door in world['doors']:
        assert not blocked(door['x'],door['y'],world['collision'])
        for step in range(-65,66,5):
            x=door['x']+(step if door['axis']=='y' else 0)
            y=door['y']+(step if door['axis']=='x' else 0)
            assert not blocked(x,y,world['obstacles'])
