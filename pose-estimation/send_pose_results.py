import os
import json
import grpc
from queue import Queue, Empty
from multiprocessing import Process, Event
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from sensor_data_pb2 import HumanPose
from sensor_data_pb2_grpc import SensorDataReceiverStub
from datetime import datetime
import pytz


class PoseResultsSender:
    class OnNewFileHandler(FileSystemEventHandler):
        def __init__(self, queue):
            self.queue = queue

        def on_created(self, event):
            if event.src_path.endswith("json"):
                self.queue.put(event.src_path)

    def __init__(self, folder, grpc_server_addr="localhost:50051"):
        self.should_exit = Event()
        self.new_file_queue = Queue()
        self.on_new_file_handler = self.OnNewFileHandler(self.new_file_queue)
        self.observer = Observer()
        self.observer.schedule(self.on_new_file_handler, folder, recursive=False)
        self.grpc_stub = SensorDataReceiverStub(grpc.insecure_channel(grpc_server_addr))

    def __call__(self, *args, **kwargs):
        self.observer.start()
        self.grpc_stub.StreamHumanPose(self.process_new_file_queue())  # Blocking call. Otherwise, just do self.observer.join()

    def process_new_file_queue(self):
        while not self.should_exit.is_set():
            try:
                filename = self.new_file_queue.get(timeout=2)
            except Empty:
                continue  # Nothing to do, just added a timeout so we can check self.should_exit and exit gracefully
            t = datetime.fromtimestamp(os.path.getmtime(filename), pytz.timezone('America/Montreal'))  # Use modification time as frame timestamp
            print("@{} - file created: {}".format(t, filename))

            # Open json
            with open(filename) as f:
                parsed_pose = json.load(f)
            os.remove(filename)

            # Send poses
            for i, person in enumerate(parsed_pose["people"]):
                pose = person["pose_keypoints_2d"]
                h = HumanPose()
                h.person_id = i + 1
                h.t.FromDatetime(t)
                h.pos_x.extend(pose[0::3])
                h.pos_y.extend(pose[1::3])
                h.joint_confidence.extend(pose[2::3])
                yield h
        print("Closing new_file_queue!")
        self._stop()  # Not really necessary since observer uses a daemon thread but just in case...

    def _stop(self):
        self.observer.stop()
        self.observer.join()
        print("Filesystem observer stopped!")

    def stop(self):
        self.should_exit.set()


class PoseResultsSenderProcess:
    """
    Helper class that runs PoseResultsSender in a separate process
    """

    def __init__(self, folder):
        self.pose_sender = PoseResultsSender(folder)
        self.pose_sender_process = Process(target=self.pose_sender)  # Spawn a new process and run the PoseResultsSender in it
        self.pose_sender_process.daemon = True  # Kill the process when the main process is killed
        self.pose_sender_process.start()

    def stop(self, graceful=True):
        if graceful:
            self.pose_sender.stop()
            import time
            time.sleep(3)
        self.pose_sender_process.terminate()
        self.pose_sender_process.join()
