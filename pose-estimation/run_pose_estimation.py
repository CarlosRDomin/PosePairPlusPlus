import os
import shutil
from openpose import pyopenpose as op
from send_pose_results import PoseResultsSenderProcess


class OpenPoseRunner:
    MODEL_PATH = "openpose-models"
    OUTPUT_PATH_FORMAT = "output-pose_{}"

    def __init__(self, cam_id=0, bool_display=True, bool_save_video=False):
        self.prefix = self.OUTPUT_PATH_FORMAT.format(cam_id)
        self.openpose_params = {
            "model_folder": self.MODEL_PATH,
            "camera": cam_id,
            "write_video": self.prefix + ".mp4" if bool_save_video else "",
            "write_json": self.prefix,
            "no_gui_verbose": False,  # True = Don't write fps, num people, etc on GUI
            "display": 2 if bool_display else 0,
            "render_pose": 1 if bool_display else 0,  # 1 for CPU (slightly faster), 2 for GPU
        }
        self.openpose_wrapper = op.WrapperPython(3)
        self.openpose_wrapper.configure(self.openpose_params)

    def __call__(self, *args, **kwargs):
        # Create folder (delete contents if existed). Necessary so dir_watcher doesn't crash
        shutil.rmtree(self.prefix, ignore_errors=True)
        os.makedirs(self.prefix)

        self.dir_watcher = PoseResultsSenderProcess(self.prefix)
        self.openpose_wrapper.execute()  # Blocking call
        self.dir_watcher.stop(False)
        print("Bye")


if __name__ == '__main__':
    o = OpenPoseRunner()
    o()
