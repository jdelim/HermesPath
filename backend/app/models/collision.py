from sqlalchemy import Column, Integer, Float, String, DateTime
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass

class Collision(Base):
    __tablename__ = "collisions"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # location
    latitude = Column(Float, nullable=False, index=True)
    longitude = Column(Float, nullable=False, index=True)
    
    # time
    year = Column(Integer)
    month = Column(Integer)
    day = Column(Integer)
    hour = Column(Integer)
    minute = Column(Integer)
    day_of_week = Column(String)
    
    # location details
    state = Column(String)
    county = Column(String)
    city = Column(String)
    
    # severity
    fatals = Column(Integer)
    persons = Column(Integer)
    vehicles = Column(Integer)
    
    # conditions
    weather = Column(String)
    light_condition = Column(String)
    road_type = Column(String)
    
    # crash details
    manner_of_collision = Column(String)
    harmful_event = Column(String)
    
    # original ID (for reference)
    st_case = Column(Integer, unique=True)

